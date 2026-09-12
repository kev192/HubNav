<script lang="ts">
  import { onMount } from 'svelte'
  import { cloudBackupApi, getErrorMessage } from '../lib/api'
  import type { CloudBackupRecord, CloudBackupTask } from '../../shared/types'

  type AsyncVoid = void | Promise<void>

  type TaskForm = {
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
  }

  const fallbackTimezones = [
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Taipei',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Bangkok',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Australia/Sydney',
    'UTC',
  ]
  const timezoneOptions = Intl.supportedValuesOf?.('timeZone')?.length
    ? Intl.supportedValuesOf('timeZone')
    : fallbackTimezones

  const emptyForm: TaskForm = {
    name: '',
    enabled: true,
    interval_hours: 24,
    start_time: '00:00',
    timezone: 'Asia/Shanghai',
    retention_count: 7,
    endpoint_url: '',
    addressing_style: 'path',
    bucket: '',
    region: 'auto',
    access_key_id: '',
    secret_access_key: '',
    prefix: 'navhub-backups/',
  }

  let tasks: CloudBackupTask[] = []
  let loading = false
  let saving = false
  let runningTaskId: number | null = null
  let deletingTaskId: number | null = null
  let error = ''
  let message = ''
  let formOpen = false
  let editingTask: CloudBackupTask | null = null
  let form: TaskForm = { ...emptyForm }
  let expandedTaskId: number | null = null
  let records: CloudBackupRecord[] = []
  let recordsLoading = false
  let recordActionId: number | null = null
  export let onRestoreData: (() => AsyncVoid) | undefined = undefined

  $: taskButtonDisabled = loading || saving || runningTaskId != null || deletingTaskId != null

  onMount(() => {
    void loadTasks()
  })

  async function loadTasks(): Promise<void> {
    loading = true
    error = ''
    try {
      tasks = await cloudBackupApi.listTasks()
    } catch (loadError) {
      error = getErrorMessage(loadError)
    } finally {
      loading = false
    }
  }

  function openCreate(): void {
    editingTask = null
    form = { ...emptyForm }
    formOpen = true
    message = ''
    error = ''
  }

  function openEdit(task: CloudBackupTask): void {
    editingTask = task
    form = {
      name: task.name,
      enabled: task.enabled,
      interval_hours: task.interval_hours,
      start_time: task.start_time,
      timezone: task.timezone,
      retention_count: task.retention_count,
      endpoint_url: task.endpoint_url,
      addressing_style: task.addressing_style,
      bucket: task.bucket,
      region: task.region,
      access_key_id: task.access_key_id,
      secret_access_key: '',
      prefix: task.prefix,
    }
    formOpen = true
    message = ''
    error = ''
  }

  function closeForm(): void {
    formOpen = false
    editingTask = null
  }

  function payloadFromForm(enabledOverride?: boolean) {
    return {
      name: form.name.trim(),
      enabled: enabledOverride ?? form.enabled,
      interval_hours: Number(form.interval_hours),
      start_time: form.start_time,
      timezone: form.timezone,
      retention_count: Number(form.retention_count),
      endpoint_url: form.endpoint_url.trim(),
      addressing_style: form.addressing_style,
      bucket: form.bucket.trim(),
      region: form.region.trim() || 'auto',
      access_key_id: form.access_key_id.trim(),
      secret_access_key: form.secret_access_key || undefined,
      prefix: form.prefix.trim(),
    }
  }

  async function submitTask(): Promise<void> {
    if (!editingTask && !form.secret_access_key) {
      error = '访问密码不能为空。'
      return
    }
    saving = true
    error = ''
    message = ''
    try {
      if (editingTask) {
        await cloudBackupApi.updateTask(editingTask.id, payloadFromForm())
        message = '云端备份任务已更新。'
      } else {
        await cloudBackupApi.createTask(payloadFromForm())
        message = '云端备份任务已创建。'
      }
      formOpen = false
      editingTask = null
      await loadTasks()
    } catch (submitError) {
      error = getErrorMessage(submitError)
    } finally {
      saving = false
    }
  }

  async function toggleTask(task: CloudBackupTask): Promise<void> {
    saving = true
    error = ''
    message = ''
    try {
      await cloudBackupApi.updateTask(task.id, {
        name: task.name,
        enabled: !task.enabled,
        interval_hours: task.interval_hours,
        start_time: task.start_time,
        timezone: task.timezone,
        retention_count: task.retention_count,
        endpoint_url: task.endpoint_url,
        addressing_style: task.addressing_style,
        bucket: task.bucket,
        region: task.region,
        access_key_id: task.access_key_id,
        secret_access_key: undefined,
        prefix: task.prefix,
      })
      message = task.enabled ? `已关闭任务「${task.name}」。` : `已启用任务「${task.name}」。`
      await loadTasks()
    } catch (toggleError) {
      error = getErrorMessage(toggleError)
    } finally {
      saving = false
    }
  }

  async function deleteTask(task: CloudBackupTask): Promise<void> {
    if (!window.confirm(`删除任务「${task.name}」？任务配置与备份记录清单会一并删除，远端存储桶中的对象会保留。`)) return
    deletingTaskId = task.id
    error = ''
    message = ''
    try {
      await cloudBackupApi.deleteTask(task.id)
      if (expandedTaskId === task.id) {
        expandedTaskId = null
        records = []
      }
      message = '云端备份任务已删除。'
      await loadTasks()
    } catch (deleteError) {
      error = getErrorMessage(deleteError)
    } finally {
      deletingTaskId = null
    }
  }

  async function runTask(task: CloudBackupTask): Promise<void> {
    runningTaskId = task.id
    error = ''
    message = ''
    try {
      const result = await cloudBackupApi.runTask(task.id)
      message = `备份完成：${result.record.file_name}。`
      await loadTasks()
      if (expandedTaskId === task.id) await loadRecords(task.id)
    } catch (runError) {
      error = getErrorMessage(runError)
      await loadTasks()
    } finally {
      runningTaskId = null
    }
  }

  async function toggleRecords(task: CloudBackupTask): Promise<void> {
    if (expandedTaskId === task.id) {
      expandedTaskId = null
      return
    }
    expandedTaskId = task.id
    await loadRecords(task.id)
  }

  async function loadRecords(taskId: number): Promise<void> {
    recordsLoading = true
    error = ''
    try {
      records = await cloudBackupApi.listRecords(taskId)
    } catch (recordError) {
      error = getErrorMessage(recordError)
    } finally {
      recordsLoading = false
    }
  }

  async function downloadRecord(record: CloudBackupRecord): Promise<void> {
    recordActionId = record.id
    error = ''
    try {
      await cloudBackupApi.downloadRecord(record.id, record.file_name)
    } catch (downloadError) {
      error = getErrorMessage(downloadError)
    } finally {
      recordActionId = null
    }
  }

  async function restoreRecord(record: CloudBackupRecord): Promise<void> {
    if (!window.confirm(`还原「${record.file_name}」会覆盖当前全部分类、书签与站点设置，此操作不可撤销。确定继续吗？`)) return
    recordActionId = record.id
    error = ''
    message = ''
    try {
      const result = await cloudBackupApi.restoreRecord(record.id)
      await onRestoreData?.()
      message = `还原成功：${result.categories} 个分类、${result.bookmarks} 个书签。`
    } catch (restoreError) {
      error = getErrorMessage(restoreError)
    } finally {
      recordActionId = null
    }
  }

  async function deleteRecord(record: CloudBackupRecord): Promise<void> {
    if (!window.confirm(`删除云端备份「${record.file_name}」？远端对象也会被删除。`)) return
    recordActionId = record.id
    error = ''
    try {
      await cloudBackupApi.deleteRecord(record.id)
      message = '云端备份已删除。'
      if (expandedTaskId != null) await loadRecords(expandedTaskId)
    } catch (deleteRecordError) {
      error = getErrorMessage(deleteRecordError)
    } finally {
      recordActionId = null
    }
  }

  function formatDateTime(timestamp: number | null): string {
    return timestamp == null ? '—' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
  }

  function formatSize(size: number): string {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  }

  function scheduleText(task: CloudBackupTask): string {
    return `每 ${task.interval_hours} 小时 · ${task.start_time} ${task.timezone}`
  }
</script>

<section class="cloud-backup" aria-labelledby="cloud-backup-title">
  <div class="cloud-header">
    <div>
      <h3 id="cloud-backup-title">云端备份</h3>
      <p class="cloud-desc">创建多个 S3 兼容备份任务，支持 Cloudflare R2、AWS S3 与其他兼容存储；每个任务可独立调度、执行、下载与还原。</p>
    </div>
    <button type="button" class="primary-button" on:click={openCreate} disabled={taskButtonDisabled}>新增备份任务</button>
  </div>

  {#if error}
    <p class="cloud-alert error">{error}</p>
  {:else if message}
    <p class="cloud-alert ok">{message}</p>
  {/if}

  {#if formOpen}
    <form class="task-form" on:submit|preventDefault={submitTask}>
      <div class="form-title">
        <h4>{editingTask ? `编辑任务：${editingTask.name}` : '新增云端备份任务'}</h4>
        <button type="button" class="ghost-button" on:click={closeForm} disabled={saving}>取消</button>
      </div>
      <div class="form-grid">
        <label><span>任务名称 *</span><input bind:value={form.name} required maxlength="100" placeholder="例如：R2 每日备份" /></label>
        <label><span>状态</span><select bind:value={form.enabled}><option value={true}>启用</option><option value={false}>关闭</option></select></label>
        <label><span>执行间隔（小时）*</span><input type="number" bind:value={form.interval_hours} min="1" max="8760" step="1" required /></label>
        <label><span>开始时间 *</span><input type="time" bind:value={form.start_time} required /></label>
        <label><span>时区 *</span><select bind:value={form.timezone}>{#each timezoneOptions as zone (zone)}<option value={zone}>{zone}</option>{/each}</select></label>
        <label><span>保留份数 *</span><input type="number" bind:value={form.retention_count} min="1" max="1000" step="1" required /></label>
        <label class="wide"><span>S3 端点 URL *</span><input bind:value={form.endpoint_url} required placeholder="https://<accountid>.r2.cloudflarestorage.com" /></label>
        <label><span>寻址方式 *</span><select bind:value={form.addressing_style}><option value="path">path-style（默认）</option><option value="virtual-hosted">virtual-hosted-style</option></select></label>
        <label><span>存储桶名称 *</span><input bind:value={form.bucket} required placeholder="navhub-backups" /></label>
        <label><span>区域</span><input bind:value={form.region} placeholder="auto" /></label>
        <label><span>访问 ID *</span><input bind:value={form.access_key_id} required autocomplete="off" /></label>
        <label><span>访问密码 {editingTask ? '（留空保持不变）' : '*'} </span><input type="password" bind:value={form.secret_access_key} autocomplete="new-password" placeholder={editingTask ? '留空表示不修改' : ''} /></label>
        <label class="wide"><span>存储路径前缀</span><input bind:value={form.prefix} placeholder="navhub-backups/" /></label>
      </div>
      <div class="form-actions">
        <button type="submit" class="primary-button" disabled={saving}>{saving ? '保存中...' : editingTask ? '保存任务' : '创建任务'}</button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="cloud-empty">正在加载云端备份任务...</p>
  {:else if tasks.length === 0}
    <p class="cloud-empty">还没有云端备份任务。点击“新增备份任务”开始配置 S3 / R2 自动备份。</p>
  {:else}
    <div class="task-list">
      {#each tasks as task (task.id)}
        <article class="task-card" class:disabled={!task.enabled}>
          <div class="task-main">
            <div class="task-title">
              <h4>{task.name}</h4>
              <span class="status-badge" class:enabled={task.enabled}>{task.enabled ? '已启用' : '已关闭'}</span>
            </div>
            <dl>
              <div><dt>调度</dt><dd>{scheduleText(task)}</dd></div>
              <div><dt>下一次执行</dt><dd>{formatDateTime(task.next_run_at)}</dd></div>
              <div><dt>上次执行</dt><dd>{formatDateTime(task.last_run_at)}{task.last_run_status ? ` · ${task.last_run_status === 'success' ? '成功' : task.last_run_status === 'failed' ? '失败' : '执行中'}` : ''}</dd></div>
              <div><dt>保留</dt><dd>{task.retention_count} 份</dd></div>
              <div><dt>存储桶</dt><dd>{task.bucket}</dd></div>
              <div><dt>端点</dt><dd>{task.endpoint_url}</dd></div>
              <div><dt>前缀</dt><dd>{task.prefix || '根目录'}</dd></div>
              <div><dt>寻址</dt><dd>{task.addressing_style === 'path' ? 'path-style' : 'virtual-hosted-style'}</dd></div>
            </dl>
            {#if task.last_error}
              <p class="task-error">{task.last_error}</p>
            {/if}
          </div>
          <div class="task-actions">
            <button type="button" class="ghost-button" on:click={() => toggleTask(task)} disabled={taskButtonDisabled}>
              {task.enabled ? '关闭' : '启用'}
            </button>
            <button type="button" class="ghost-button" on:click={() => openEdit(task)} disabled={taskButtonDisabled}>编辑</button>
            <button type="button" class="primary-button" on:click={() => runTask(task)} disabled={taskButtonDisabled}>
              {runningTaskId === task.id ? '执行中...' : '手动执行'}
            </button>
            <button type="button" class="ghost-button" on:click={() => toggleRecords(task)} aria-expanded={expandedTaskId === task.id}>
              {expandedTaskId === task.id ? '收起记录' : '备份记录'}
            </button>
            <button type="button" class="danger-button" on:click={() => deleteTask(task)} disabled={taskButtonDisabled}>
              {deletingTaskId === task.id ? '删除中...' : '删除'}
            </button>
          </div>

          {#if expandedTaskId === task.id}
            <div class="records-panel">
              <div class="records-header">
                <h5>备份记录</h5>
                <span>{records.length} 份</span>
              </div>
              {#if recordsLoading}
                <p class="cloud-empty">正在加载备份记录...</p>
              {:else if records.length === 0}
                <p class="cloud-empty">这个任务还没有备份记录。</p>
              {:else}
                <div class="records-table" role="table" aria-label={`${task.name} 备份记录`}>
                  <div class="records-row records-head" role="row">
                    <span role="columnheader">文件名称</span>
                    <span role="columnheader">备份时间</span>
                    <span role="columnheader">文件大小</span>
                    <span role="columnheader">操作</span>
                  </div>
                  {#each records as record (record.id)}
                    <div class="records-row" role="row">
                      <span class="record-name" role="cell" title={record.file_name}>{record.file_name}</span>
                      <span role="cell">{formatDateTime(record.backup_time)}</span>
                      <span role="cell">{formatSize(record.file_size)}</span>
                      <span class="record-actions" role="cell">
                        <button type="button" on:click={() => downloadRecord(record)} disabled={recordActionId != null}>下载</button>
                        <button type="button" on:click={() => restoreRecord(record)} disabled={recordActionId != null}>还原</button>
                        <button type="button" class="danger-text" on:click={() => deleteRecord(record)} disabled={recordActionId != null}>删除</button>
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .cloud-backup {
    display: grid;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--admin-border);
    border-radius: 14px;
    background: var(--admin-control-bg);
  }

  .cloud-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .cloud-header h3,
  .cloud-header p,
  .cloud-desc {
    margin: 0;
  }

  .cloud-header h3 {
    margin-bottom: 6px;
    font-size: 15px;
  }

  .cloud-desc {
    color: var(--admin-muted);
    font-size: 13px;
    line-height: 1.6;
    max-width: 680px;
  }

  .cloud-alert {
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
  }

  .cloud-alert.error {
    border: 1px solid var(--admin-danger-border);
    background: var(--admin-danger-bg);
    color: var(--admin-danger);
  }

  .cloud-alert.ok {
    border: 1px solid var(--admin-ok-border);
    background: var(--admin-ok-bg);
    color: var(--admin-ok);
  }

  .task-form {
    display: grid;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--admin-border);
    border-radius: 12px;
    background: var(--admin-surface);
  }

  .form-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .form-title h4 {
    margin: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .form-grid label {
    display: grid;
    min-width: 0;
    gap: 6px;
    color: var(--admin-muted);
    font-size: 13px;
    font-weight: 600;
  }

  .form-grid label.wide {
    grid-column: 1 / -1;
  }

  .form-grid input,
  .form-grid select {
    min-height: 38px;
    border: 1px solid var(--admin-input-border);
    border-radius: 10px;
    background: var(--admin-input-bg);
    color: var(--admin-text);
    font: inherit;
    font-weight: 400;
    padding: 8px 10px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .cloud-empty,
  .task-error {
    margin: 0;
    color: var(--admin-muted);
    font-size: 13px;
    line-height: 1.6;
  }

  .task-error {
    color: var(--admin-danger);
  }

  .task-list {
    display: grid;
    gap: 12px;
  }

  .task-card {
    display: grid;
    gap: 14px;
    padding: 14px;
    border: 1px solid var(--admin-border);
    border-radius: 12px;
    background: var(--admin-surface);
  }

  .task-card.disabled {
    opacity: 0.72;
  }

  .task-main {
    min-width: 0;
  }

  .task-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .task-title h4 {
    margin: 0;
  }

  .status-badge {
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--admin-nav-badge-bg);
    color: var(--admin-subtle);
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.enabled {
    background: var(--admin-ok-bg);
    color: var(--admin-ok);
  }

  .task-card dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px 14px;
    margin: 0;
  }

  .task-card dl div {
    min-width: 0;
  }

  .task-card dt {
    color: var(--admin-subtle);
    font-size: 12px;
  }

  .task-card dd {
    margin: 3px 0 0;
    overflow-wrap: anywhere;
    color: var(--admin-text);
    font-size: 13px;
  }

  .task-actions,
  .record-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .primary-button,
  .ghost-button {
    min-height: 36px;
    border-radius: 10px;
    padding: 8px 13px;
    font-size: 13px;
    cursor: pointer;
  }

  .primary-button {
    border: none;
    background: #2563eb;
    color: #fff;
  }

  .ghost-button {
    border: 1px solid var(--admin-input-border);
    background: var(--admin-control-bg);
    color: var(--admin-text);
  }

  .danger-button {
    min-height: 36px;
    border: 1px solid var(--admin-danger-border);
    border-radius: 10px;
    background: var(--admin-danger-bg);
    color: var(--admin-danger);
    padding: 8px 13px;
    font-size: 13px;
    cursor: pointer;
  }

  .primary-button:disabled,
  .ghost-button:disabled,
  .danger-button:disabled,
  .record-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .records-panel {
    display: grid;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--admin-border);
  }

  .records-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .records-header h5 {
    margin: 0;
  }

  .records-header span {
    color: var(--admin-subtle);
    font-size: 12px;
  }

  .records-table {
    display: grid;
    min-width: 0;
    overflow-x: auto;
    border: 1px solid var(--admin-border);
    border-radius: 10px;
  }

  .records-row {
    display: grid;
    grid-template-columns: minmax(220px, 1.5fr) 150px 100px 210px;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--admin-border);
    color: var(--admin-text);
    font-size: 13px;
  }

  .records-row:last-child {
    border-bottom: none;
  }

  .records-head {
    background: var(--admin-control-hover-bg);
    color: var(--admin-muted);
    font-weight: 600;
  }

  .record-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record-actions button {
    min-height: 30px;
    border: 1px solid var(--admin-input-border);
    border-radius: 8px;
    background: var(--admin-control-bg);
    color: var(--admin-text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    padding: 5px 9px;
  }

  .record-actions .danger-text {
    border-color: var(--admin-danger-border);
    background: var(--admin-danger-bg);
    color: var(--admin-danger);
  }

  @media (max-width: 760px) {
    .cloud-header,
    .form-title,
    .form-actions,
    .task-actions {
      align-items: stretch;
      flex-direction: column;
      justify-content: flex-start;
    }

    .cloud-header button,
    .task-actions button {
      width: 100%;
    }

    .records-row {
      grid-template-columns: 1fr;
    }

    .records-head {
      display: none;
    }

    .record-name {
      white-space: normal;
    }
  }
</style>
