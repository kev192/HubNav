import type { AdminData, BackupData, ImportResp } from '../../shared/types'
import { normalizeCategoryParentId } from '../../shared/categoryHierarchy'

export const BACKUP_VERSION = 2

export type BackupExportArtifact = {
  payload: BackupData
  json: string
  fileName: string
  message: string
}

export function createBackupPayload(
  data: Pick<AdminData, 'categories' | 'bookmarks' | 'settings'>,
  exportedAt = Date.now(),
): BackupData {
  return {
    version: BACKUP_VERSION,
    exported_at: exportedAt,
    categories: data.categories,
    bookmarks: data.bookmarks,
    settings: data.settings,
  }
}

/** 部分导出选择：以分类 id 为单位，附带 settings 导出开关。 */
export interface BackupSelection {
  /** 用户显式勾选的分类 id 集合（含一级与二级）。 */
  categoryIds: Set<number>
  /** 是否导出完整 settings；false 时导出文件 settings 为 null。 */
  includeSettings: boolean
}

/**
 * 根据选中的分类 id 过滤出子集 categories/bookmarks。
 * FR-A2 硬约束：被选中的二级分类，其一级父分类必须一并写入（即使未显式勾选），
 * 否则重新导入会因 parent_id 找不到父级被拒。只补父分类记录本身，不导出其下未选中的书签。
 */
export function selectBackupSubset(
  data: Pick<AdminData, 'categories' | 'bookmarks' | 'settings'>,
  selection: BackupSelection,
): Pick<AdminData, 'categories' | 'bookmarks' | 'settings'> {
  const selected = selection.categoryIds
  // 书签只来自显式选中的分类；父分类被隐式补入时不带出其未选中的书签。
  const bookmarks = data.bookmarks.filter((bookmark) => selected.has(bookmark.category_id))
  // 需要写入的分类 = 选中分类 + 其一级父分类。
  const needed = new Set<number>(selected)
  for (const category of data.categories) {
    if (!selected.has(category.id)) continue
    const parentId = normalizeCategoryParentId(category.parent_id)
    if (parentId !== null) needed.add(parentId)
  }
  const categories = data.categories.filter((category) => needed.has(category.id))
  return {
    categories,
    bookmarks,
    settings: selection.includeSettings ? data.settings : null,
  }
}

export function createBackupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10)
  return `cf-navs-backup-${stamp}.json`
}

export function createBackupExportMessage(payload: Pick<BackupData, 'categories' | 'bookmarks'>): string {
  return `已导出 ${payload.categories.length} 个分类、${payload.bookmarks.length} 个书签。`
}

export function createBackupExportArtifact(
  data: Pick<AdminData, 'categories' | 'bookmarks' | 'settings'>,
  exportedAt = Date.now(),
  selection?: BackupSelection,
): BackupExportArtifact {
  const source = selection ? selectBackupSubset(data, selection) : data
  const payload = createBackupPayload(source, exportedAt)
  return {
    payload,
    json: JSON.stringify(payload, null, 2),
    fileName: createBackupFileName(new Date(payload.exported_at)),
    message: createBackupExportMessage(payload),
  }
}
export function createImportSuccessMessage(result: Pick<ImportResp, 'categories' | 'bookmarks'>): string {
  return `导入成功：${result.categories} 个分类、${result.bookmarks} 个书签。`
}
