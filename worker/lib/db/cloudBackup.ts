// 云端备份任务与备份记录的 D1 数据访问层。

import type { CloudBackupRecord, CloudBackupTask } from '../../../shared/types'

export interface CloudBackupTaskInput {
  name: string
  enabled: boolean
  interval_hours: number
  start_time: string
  timezone: string
  retention_count: number
  endpoint_url: string
  addressing_style: 'path' | 'virtual-hosted'
  bucket: string
  region: string
  access_key_id: string
  secret_access_key: string
  prefix: string
  next_run_at?: number | null
}

export interface CloudBackupTaskRow {
  id: number
  name: string
  enabled: number
  interval_hours: number
  start_time: string
  timezone: string
  retention_count: number
  endpoint_url: string
  addressing_style: 'path' | 'virtual-hosted'
  bucket: string
  region: string
  access_key_id: string
  secret_access_key: string
  secret_configured?: number
  prefix: string
  last_run_at: number | null
  next_run_at: number | null
  last_run_status: 'running' | 'success' | 'failed' | null
  last_error: string | null
  created_at: number
  updated_at: number
}

interface CloudBackupRecordRow {
  id: number
  task_id: number
  file_name: string
  object_key: string
  backup_time: number
  file_size: number
  content_type: string
  created_at: number
}

export class CloudBackupNotFoundError extends Error {}

export async function ensureCloudBackupSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS cloud_backup_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      interval_hours INTEGER NOT NULL DEFAULT 24,
      start_time TEXT NOT NULL DEFAULT '00:00',
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      retention_count INTEGER NOT NULL DEFAULT 7,
      endpoint_url TEXT NOT NULL,
      addressing_style TEXT NOT NULL DEFAULT 'path',
      bucket TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'auto',
      access_key_id TEXT NOT NULL,
      secret_access_key TEXT NOT NULL,
      prefix TEXT NOT NULL DEFAULT '',
      last_run_at INTEGER,
      next_run_at INTEGER,
      last_run_status TEXT,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_cloud_backup_tasks_next_run ON cloud_backup_tasks(enabled, next_run_at)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS cloud_backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      object_key TEXT NOT NULL,
      backup_time INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/json',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES cloud_backup_tasks(id) ON DELETE CASCADE
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_cloud_backup_records_task_time ON cloud_backup_records(task_id, backup_time DESC)'),
  ])
}

function publicTask(row: CloudBackupTaskRow): CloudBackupTask {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    interval_hours: row.interval_hours,
    start_time: row.start_time,
    timezone: row.timezone,
    retention_count: row.retention_count,
    endpoint_url: row.endpoint_url,
    addressing_style: row.addressing_style,
    bucket: row.bucket,
    region: row.region,
    access_key_id: row.access_key_id,
    prefix: row.prefix,
    secret_configured: row.secret_configured === 1 || (row.secret_access_key?.length ?? 0) > 0,
    last_run_at: row.last_run_at,
    next_run_at: row.next_run_at,
    last_run_status: row.last_run_status === 'running' || row.last_run_status === 'success' || row.last_run_status === 'failed' ? row.last_run_status : null,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function record(row: CloudBackupRecordRow): CloudBackupRecord {
  return { ...row }
}

export async function listCloudBackupTasks(db: D1Database): Promise<CloudBackupTask[]> {
  await ensureCloudBackupSchema(db)
  const { results } = await db
    .prepare(`SELECT id, name, enabled, interval_hours, start_time, timezone, retention_count,
      endpoint_url, addressing_style, bucket, region, access_key_id, length(secret_access_key) AS secret_configured,
      prefix, last_run_at, next_run_at, last_run_status, last_error, created_at, updated_at
      FROM cloud_backup_tasks ORDER BY created_at DESC, id DESC`)
    .all<CloudBackupTaskRow>()
  return (results ?? []).map(publicTask)
}

export async function getCloudBackupTaskRow(db: D1Database, id: number): Promise<CloudBackupTaskRow> {
  await ensureCloudBackupSchema(db)
  const row = await db
    .prepare(`SELECT id, name, enabled, interval_hours, start_time, timezone, retention_count,
      endpoint_url, addressing_style, bucket, region, access_key_id, secret_access_key, prefix,
      last_run_at, next_run_at, last_run_status, last_error, created_at, updated_at
      FROM cloud_backup_tasks WHERE id = ?`)
    .bind(id)
    .first<CloudBackupTaskRow>()
  if (!row) throw new CloudBackupNotFoundError('cloud backup task not found')
  return row
}

export async function getCloudBackupTask(db: D1Database, id: number): Promise<CloudBackupTask> {
  return publicTask(await getCloudBackupTaskRow(db, id))
}

export async function createCloudBackupTask(
  db: D1Database,
  input: CloudBackupTaskInput,
  now = Date.now(),
): Promise<CloudBackupTask> {
  await ensureCloudBackupSchema(db)
  const result = await db
    .prepare(`INSERT INTO cloud_backup_tasks (
      name, enabled, interval_hours, start_time, timezone, retention_count, endpoint_url,
      addressing_style, bucket, region, access_key_id, secret_access_key, prefix,
      next_run_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      input.name,
      input.enabled ? 1 : 0,
      input.interval_hours,
      input.start_time,
      input.timezone,
      input.retention_count,
      input.endpoint_url,
      input.addressing_style,
      input.bucket,
      input.region,
      input.access_key_id,
      input.secret_access_key,
      input.prefix,
      input.next_run_at ?? null,
      now,
      now,
    )
    .run()
  return getCloudBackupTask(db, Number(result.meta.last_row_id))
}

export async function updateCloudBackupTask(
  db: D1Database,
  id: number,
  input: CloudBackupTaskInput,
  now = Date.now(),
): Promise<CloudBackupTask> {
  await ensureCloudBackupSchema(db)
  const result = await db
    .prepare(`UPDATE cloud_backup_tasks SET
      name = ?, enabled = ?, interval_hours = ?, start_time = ?, timezone = ?, retention_count = ?,
      endpoint_url = ?, addressing_style = ?, bucket = ?, region = ?, access_key_id = ?,
      secret_access_key = ?, prefix = ?, next_run_at = ?, updated_at = ? WHERE id = ?`)
    .bind(
      input.name,
      input.enabled ? 1 : 0,
      input.interval_hours,
      input.start_time,
      input.timezone,
      input.retention_count,
      input.endpoint_url,
      input.addressing_style,
      input.bucket,
      input.region,
      input.access_key_id,
      input.secret_access_key,
      input.prefix,
      input.next_run_at ?? null,
      now,
      id,
    )
    .run()
  if (result.meta.changes === 0) throw new CloudBackupNotFoundError('cloud backup task not found')
  return getCloudBackupTask(db, id)
}

export async function deleteCloudBackupTask(db: D1Database, id: number): Promise<void> {
  await ensureCloudBackupSchema(db)
  await db.batch([
    db.prepare('DELETE FROM cloud_backup_records WHERE task_id = ?').bind(id),
    db.prepare('DELETE FROM cloud_backup_tasks WHERE id = ?').bind(id),
  ])
}

export async function claimCloudBackupTaskRun(
  db: D1Database,
  id: number,
  nextRunAt: number,
  now = Date.now(),
): Promise<void> {
  const result = await db
    .prepare(`UPDATE cloud_backup_tasks SET next_run_at = ?, last_run_status = 'running', last_error = NULL, updated_at = ? WHERE id = ?`)
    .bind(nextRunAt, now, id)
    .run()
  if (result.meta.changes === 0) throw new CloudBackupNotFoundError('cloud backup task not found')
}

export async function completeCloudBackupTaskRun(
  db: D1Database,
  id: number,
  status: 'success' | 'failed',
  lastRunAt: number,
  nextRunAt: number,
  error: string | null = null,
  now = Date.now(),
): Promise<void> {
  await db
    .prepare(`UPDATE cloud_backup_tasks SET last_run_at = ?, next_run_at = ?, last_run_status = ?, last_error = ?, updated_at = ? WHERE id = ?`)
    .bind(lastRunAt, nextRunAt, status, error, now, id)
    .run()
}

export async function listCloudBackupRecords(db: D1Database, taskId: number): Promise<CloudBackupRecord[]> {
  await ensureCloudBackupSchema(db)
  const { results } = await db
    .prepare(`SELECT id, task_id, file_name, object_key, backup_time, file_size, content_type, created_at
      FROM cloud_backup_records WHERE task_id = ? ORDER BY backup_time DESC, id DESC`)
    .bind(taskId)
    .all<CloudBackupRecordRow>()
  return (results ?? []).map(record)
}

export async function getCloudBackupRecordRow(db: D1Database, id: number): Promise<CloudBackupRecordRow> {
  await ensureCloudBackupSchema(db)
  const row = await db
    .prepare(`SELECT id, task_id, file_name, object_key, backup_time, file_size, content_type, created_at
      FROM cloud_backup_records WHERE id = ?`)
    .bind(id)
    .first<CloudBackupRecordRow>()
  if (!row) throw new CloudBackupNotFoundError('cloud backup record not found')
  return row
}

export async function createCloudBackupRecord(
  db: D1Database,
  input: Omit<CloudBackupRecord, 'id'>,
): Promise<CloudBackupRecord> {
  const result = await db
    .prepare(`INSERT INTO cloud_backup_records (task_id, file_name, object_key, backup_time, file_size, content_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.task_id, input.file_name, input.object_key, input.backup_time, input.file_size, input.content_type, input.created_at)
    .run()
  return { ...input, id: Number(result.meta.last_row_id) }
}

export async function deleteCloudBackupRecord(db: D1Database, id: number): Promise<void> {
  const result = await db.prepare('DELETE FROM cloud_backup_records WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) throw new CloudBackupNotFoundError('cloud backup record not found')
}
