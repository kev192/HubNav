// 云端备份执行服务：生成标准 NavHub 备份 JSON，上传到 S3，并应用保留策略。

import type { BackupData, CloudBackupRecord } from '../../shared/types'
import { getSettings, listBookmarks, listCategories } from './db'
import {
  claimCloudBackupTaskRun,
  completeCloudBackupTaskRun,
  createCloudBackupRecord,
  deleteCloudBackupRecord,
  ensureCloudBackupSchema,
  listCloudBackupRecords,
  type CloudBackupTaskRow,
} from './db/cloudBackup'
import { calculateNextRunAt, calculateNextRunAtAfterRun } from './cloudBackupSchedule'
import { s3DeleteObject, s3PutObject, type S3Config } from './s3'

const BACKUP_VERSION = 2

function taskS3Config(row: CloudBackupTaskRow): S3Config {
  return {
    endpointUrl: row.endpoint_url,
    addressingStyle: row.addressing_style,
    bucket: row.bucket,
    region: row.region,
    accessKeyId: row.access_key_id,
    secretAccessKey: row.secret_access_key ?? '',
  }
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, '')
  return trimmed ? `${trimmed.replace(/\/+$/, '')}/` : ''
}

function createBackupFileName(timestamp: number): string {
  const date = new Date(timestamp)
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
  return `cf-navs-cloud-backup-${stamp}.json`
}

async function createBackupPayload(db: D1Database, now: number): Promise<BackupData> {
  const [categories, bookmarks, settings] = await Promise.all([
    listCategories(db),
    listBookmarks(db),
    getSettings(db),
  ])
  return {
    version: BACKUP_VERSION,
    exported_at: now,
    categories,
    bookmarks,
    settings,
  }
}

async function applyRetention(db: D1Database, row: CloudBackupTaskRow): Promise<string | null> {
  const records = await listCloudBackupRecords(db, row.id)
  const expired = records.slice(Math.max(0, row.retention_count))
  const errors: string[] = []
  for (const item of expired) {
    try {
      await s3DeleteObject(taskS3Config(row), item.object_key)
      await deleteCloudBackupRecord(db, item.id)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  return errors.length > 0 ? `备份已上传，但清理过期备份失败：${errors[0]}` : null
}

export async function runCloudBackupTask(
  db: D1Database,
  row: CloudBackupTaskRow,
  now = Date.now(),
): Promise<{ task: CloudBackupTaskRow; record: CloudBackupRecord }> {
  const nextRunAt = calculateNextRunAtAfterRun({
    enabled: row.enabled === 1,
    intervalHours: row.interval_hours,
    now,
  })
  await claimCloudBackupTaskRun(db, row.id, nextRunAt, now)

  try {
    const payload = await createBackupPayload(db, now)
    const json = JSON.stringify(payload, null, 2)
    const jsonByteSize = new TextEncoder().encode(json).length
    const fileName = createBackupFileName(now)
    const objectKey = `${normalizePrefix(row.prefix)}${fileName}`
    const fileSize = await s3PutObject(taskS3Config(row), objectKey, json)
    const created = await createCloudBackupRecord(db, {
      task_id: row.id,
      file_name: fileName,
      object_key: objectKey,
      backup_time: now,
      file_size: fileSize || jsonByteSize,
      content_type: 'application/json',
      created_at: now,
    })
    const retentionError = await applyRetention(db, row)
    await completeCloudBackupTaskRun(
      db,
      row.id,
      'success',
      now,
      nextRunAt,
      retentionError,
      now,
    )
    return { task: { ...row, last_run_at: now, next_run_at: nextRunAt, last_run_status: 'success', last_error: retentionError }, record: created }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await completeCloudBackupTaskRun(db, row.id, 'failed', now, nextRunAt, message, now)
    throw error
  }
}

export async function runDueCloudBackupTasks(db: D1Database, now = Date.now()): Promise<number> {
  await ensureCloudBackupSchema(db)
  const { results } = await db
    .prepare(`SELECT id, name, enabled, interval_hours, start_time, timezone, retention_count,
      endpoint_url, addressing_style, bucket, region, access_key_id, secret_access_key, prefix,
      last_run_at, next_run_at, last_run_status, last_error, created_at, updated_at
      FROM cloud_backup_tasks WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at LIMIT 10`)
    .bind(now)
    .all<CloudBackupTaskRow>()

  let executed = 0
  for (const row of results ?? []) {
    try {
      await runCloudBackupTask(db, row, now)
      executed += 1
    } catch (error) {
      console.error('cloud backup task failed', { taskId: row.id, error })
    }
  }
  return executed
}

export function nextRunAtForTask(row: CloudBackupTaskRow, enabled: boolean, now = Date.now()): number | null {
  return calculateNextRunAt({
    enabled,
    intervalHours: row.interval_hours,
    startTime: row.start_time,
    timeZone: row.timezone,
    lastRunAt: row.last_run_at,
    now,
  })
}

export function cloudBackupS3Config(row: CloudBackupTaskRow): S3Config {
  return taskS3Config(row)
}
