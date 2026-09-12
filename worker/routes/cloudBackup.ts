// /api/cloud-backup/*：S3 兼容云端备份任务管理、执行、下载、还原与删除。

import { Hono } from 'hono'
import {
  ErrCode,
  type CloudBackupRecord,
  type CloudBackupRestoreResp,
  type CloudBackupRunResp,
  type CloudBackupTask,
  type CloudBackupTaskUpsertReq,
  type ImportReq,
} from '../../shared/types'
import { invalidatePublicDataCache, invalidateSiteConfigCache } from '../lib/cache'
import { runCloudBackupTask, cloudBackupS3Config } from '../lib/cloudBackup'
import { calculateNextRunAt, isValidTimezone } from '../lib/cloudBackupSchedule'
import { getSettings, importData, touchDataVersion } from '../lib/db'
import {
  CloudBackupNotFoundError,
  createCloudBackupTask,
  deleteCloudBackupRecord,
  deleteCloudBackupTask,
  getCloudBackupRecordRow,
  getCloudBackupTask,
  getCloudBackupTaskRow,
  listCloudBackupRecords,
  listCloudBackupTasks,
  updateCloudBackupTask,
  type CloudBackupTaskInput,
} from '../lib/db/cloudBackup'
import { validateImportPayload } from '../lib/importValidation'
import { fail, ok } from '../lib/response'
import { badRequest, parseId, readJson } from '../lib/routeHelpers'
import { invalidateRuntimeDataCache } from '../lib/runtimeCache'
import { s3DeleteObject, s3GetObject } from '../lib/s3'
import type { HonoEnv } from '../types'

export const cloudBackupRoutes = new Hono<HonoEnv>()

function validateTaskPayload(body: CloudBackupTaskUpsertReq | null, requireSecret: boolean): CloudBackupTaskInput | string {
  if (!body) return 'invalid request body'
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const endpointUrl = typeof body.endpoint_url === 'string' ? body.endpoint_url.trim() : ''
  const bucket = typeof body.bucket === 'string' ? body.bucket.trim() : ''
  const region = typeof body.region === 'string' && body.region.trim() ? body.region.trim() : 'auto'
  const accessKeyId = typeof body.access_key_id === 'string' ? body.access_key_id.trim() : ''
  const secretAccessKey = typeof body.secret_access_key === 'string' ? body.secret_access_key : ''
  const prefix = typeof body.prefix === 'string' ? body.prefix.trim() : ''
  const intervalHours = Number(body.interval_hours)
  const retentionCount = Number(body.retention_count)

  if (typeof body.enabled !== 'boolean') return '任务状态无效'
  if (name.length < 1 || name.length > 100) return '任务名称必须为 1-100 个字符'
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 8760) return '执行间隔必须为 1-8760 小时'
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.start_time ?? '')) return '开始时间格式必须为 HH:MM'
  if (!body.timezone || !isValidTimezone(body.timezone)) return '时区无效'
  if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 1000) return '保留份数必须为 1-1000'
  if (!/^https?:\/\//i.test(endpointUrl)) return 'S3 端点 URL 必须以 http:// 或 https:// 开头'
  try {
    const parsed = new URL(endpointUrl)
    if (!parsed.hostname) return 'S3 端点 URL 无效'
  } catch {
    return 'S3 端点 URL 无效'
  }
  if (body.addressing_style !== 'path' && body.addressing_style !== 'virtual-hosted') return '寻址方式无效'
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return '存储桶名称无效'
  if (region.length < 1 || region.length > 64) return '区域必须为 1-64 个字符'
  if (accessKeyId.length < 1 || accessKeyId.length > 128) return '访问 ID 必须为 1-128 个字符'
  if (requireSecret && secretAccessKey.length < 1) return '访问密码不能为空'
  if (secretAccessKey.length > 4096) return '访问密码过长'
  if (prefix.length > 512) return '存储路径前缀不能超过 512 个字符'
  if (prefix.includes('..')) return '存储路径前缀不能包含 ..'

  return {
    name,
    enabled: body.enabled === true,
    interval_hours: intervalHours,
    start_time: body.start_time,
    timezone: body.timezone,
    retention_count: retentionCount,
    endpoint_url: endpointUrl,
    addressing_style: body.addressing_style,
    bucket,
    region,
    access_key_id: accessKeyId,
    secret_access_key: secretAccessKey,
    prefix,
  }
}

function nextRunAt(input: CloudBackupTaskInput, lastRunAt: number | null): number | null {
  if (!input.enabled) return null
  return calculateNextRunAt({
    enabled: true,
    intervalHours: input.interval_hours,
    startTime: input.start_time,
    timeZone: input.timezone,
    lastRunAt,
    now: Date.now(),
  })
}
cloudBackupRoutes.get('/cloud-backup/tasks', async (c) => {
  try {
    return c.json(ok<CloudBackupTask[]>(await listCloudBackupTasks(c.env.DB)))
  } catch {
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to load cloud backup tasks'))
  }
})

cloudBackupRoutes.post('/cloud-backup/tasks', async (c) => {
  const input = validateTaskPayload(await readJson<CloudBackupTaskUpsertReq>(c), true)
  if (typeof input === 'string') return badRequest(c, input)
  try {
    const task = await createCloudBackupTask(c.env.DB, { ...input, next_run_at: nextRunAt(input, null) })
    return c.json(ok<CloudBackupTask>(task))
  } catch {
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to create cloud backup task'))
  }
})

cloudBackupRoutes.put('/cloud-backup/tasks/:id', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid task id')
  const input = validateTaskPayload(await readJson<CloudBackupTaskUpsertReq>(c), false)
  if (typeof input === 'string') return badRequest(c, input)
  try {
    const existing = await getCloudBackupTaskRow(c.env.DB, id)
    const merged = { ...input, secret_access_key: input.secret_access_key || existing.secret_access_key }
    const task = await updateCloudBackupTask(c.env.DB, id, { ...merged, next_run_at: nextRunAt(merged, existing.last_run_at) })
    return c.json(ok<CloudBackupTask>(task))
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup task not found'))
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to update cloud backup task'))
  }
})

cloudBackupRoutes.delete('/cloud-backup/tasks/:id', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid task id')
  try {
    await deleteCloudBackupTask(c.env.DB, id)
    return c.json(ok<null>(null, 'deleted'))
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup task not found'))
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to delete cloud backup task'))
  }
})

cloudBackupRoutes.post('/cloud-backup/tasks/:id/run', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid task id')
  try {
    const row = await getCloudBackupTaskRow(c.env.DB, id)
    const result = await runCloudBackupTask(c.env.DB, row)
    const task = await getCloudBackupTask(c.env.DB, id)
    return c.json(ok<CloudBackupRunResp>({ task, record: result.record }))
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup task not found'))
    const message = error instanceof Error ? error.message : 'unknown error'
    return c.json(fail(ErrCode.SERVER_ERROR, `云端备份失败：${message}`))
  }
})

cloudBackupRoutes.get('/cloud-backup/tasks/:id/records', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid task id')
  try {
    return c.json(ok<CloudBackupRecord[]>(await listCloudBackupRecords(c.env.DB, id)))
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup task not found'))
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to load cloud backup records'))
  }
})

cloudBackupRoutes.get('/cloud-backup/records/:id/download', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid record id')
  try {
    const record = await getCloudBackupRecordRow(c.env.DB, id)
    const task = await getCloudBackupTaskRow(c.env.DB, record.task_id)
    const content = await s3GetObject(cloudBackupS3Config(task), record.object_key)
    return new Response(content, {
      headers: {
        'content-type': record.content_type || 'application/json',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(record.file_name)}`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup record not found'))
    const message = error instanceof Error ? error.message : 'unknown error'
    return c.json(fail(ErrCode.SERVER_ERROR, `下载云端备份失败：${message}`))
  }
})

cloudBackupRoutes.post('/cloud-backup/records/:id/restore', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid record id')
  try {
    const record = await getCloudBackupRecordRow(c.env.DB, id)
    const task = await getCloudBackupTaskRow(c.env.DB, record.task_id)
    const content = await s3GetObject(cloudBackupS3Config(task), record.object_key)
    let parsed: unknown
    try {
      parsed = JSON.parse(content) as unknown
    } catch {
      return c.json(fail(ErrCode.BAD_REQUEST, '备份文件不是有效 JSON'))
    }
    const validation = validateImportPayload(parsed as ImportReq)
    if (!validation.ok) return badRequest(c, validation.message)
    const result = await importData(c.env.DB, {
      categories: validation.payload.categories,
      bookmarks: validation.payload.bookmarks,
      settings: validation.payload.settings,
    })
    const settings = await getSettings(c.env.DB)
    const version = await touchDataVersion(c.env.DB)
    invalidateRuntimeDataCache()
    invalidatePublicDataCache(c, c.req.url)
    invalidateSiteConfigCache(c, c.req.url)
    return c.json(ok<CloudBackupRestoreResp & { settings: typeof settings; version: string }>({
      categories: result.categories,
      bookmarks: result.bookmarks,
      settings,
      version,
    }))
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup record not found'))
    const message = error instanceof Error ? error.message : 'unknown error'
    return c.json(fail(ErrCode.SERVER_ERROR, `还原云端备份失败：${message}`))
  }
})

cloudBackupRoutes.delete('/cloud-backup/records/:id', async (c) => {
  const id = parseId(c)
  if (id == null) return badRequest(c, 'invalid record id')
  try {
    const record = await getCloudBackupRecordRow(c.env.DB, id)
    const task = await getCloudBackupTaskRow(c.env.DB, record.task_id)
    await s3DeleteObject(cloudBackupS3Config(task), record.object_key)
    await deleteCloudBackupRecord(c.env.DB, id)
    return c.json(ok<null>(null, 'deleted'))
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) return c.json(fail(ErrCode.NOT_FOUND, 'cloud backup record not found'))
    const message = error instanceof Error ? error.message : 'unknown error'
    return c.json(fail(ErrCode.SERVER_ERROR, `删除云端备份失败：${message}`))
  }
})

export default cloudBackupRoutes

