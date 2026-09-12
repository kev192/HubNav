import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('admin backup layout', () => {
  it('separates export and import into distinct operation sections', () => {
    const source = readFileSync('src/components/BackupPanel.svelte', 'utf8')

    expect(source).toContain('class="backup-operations"')
    expect(source.match(/class="backup-operation(?: [^"]*)?"/g)).toHaveLength(2)
    expect(source).toContain('id="export-backup-title"')
    expect(source).toContain('id="import-backup-title"')
    expect(source).toContain('class="import-actions"')
    expect(source).toContain('选择文件并导入')
    expect(source).not.toContain('class="backup-actions"')
  })

  it('uses the backup and recovery naming without the old eyebrow copy', () => {
    const sidebar = readFileSync('src/components/AdminSidebar.svelte', 'utf8')
    const backup = readFileSync('src/components/BackupPanel.svelte', 'utf8')
    const cloud = readFileSync('src/components/CloudBackupPanel.svelte', 'utf8')

    expect(sidebar).toContain("label: '备份与恢复'")
    expect(backup).toContain('<h2>备份与恢复</h2>')
    expect(cloud).toContain('<h3 id="cloud-backup-title">云端备份</h3>')
    for (const source of [sidebar, backup, cloud]) {
      expect(source).not.toContain('数据备份与导入')
    }
    expect(backup).not.toContain('<h2>导入 / 导出</h2>')
  })

  it('refreshes admin data after a cloud backup restore', () => {
    const cloud = readFileSync('src/components/CloudBackupPanel.svelte', 'utf8')
    const backup = readFileSync('src/components/BackupPanel.svelte', 'utf8')
    const tabs = readFileSync('src/components/admin/AdminTabContent.svelte', 'utf8')
    const admin = readFileSync('src/views/Admin.svelte', 'utf8')
    const app = readFileSync('src/App.svelte', 'utf8')

    expect(cloud).toContain('export let onRestoreData')
    expect(cloud.indexOf('await cloudBackupApi.restoreRecord(record.id)')).toBeLessThan(cloud.indexOf('await onRestoreData?.()'))
    expect(backup).toContain('<CloudBackupPanel {onRestoreData} />')
    expect(tabs).toContain('{onRestoreData}')
    expect(admin).toContain('{onRestoreData}')
    expect(app).toContain('onRestoreData={handleRestoreData}')
    expect(app).toContain('await refreshAdminDataAfterMutation()')
  })

  it('passes the selected id set into every root selection calculation', () => {
    const source = readFileSync('src/components/BackupPanel.svelte', 'utf8')

    expect(source).toContain('function rootSelectionState(root: CategoryOption, selectedIds: Set<number>)')
    expect(source.match(/rootSelectionState\(root, selectedCategoryIds\)/g)).toHaveLength(2)
  })
})
