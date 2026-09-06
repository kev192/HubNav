import type { AdminData } from '../../shared/types'
import { api, getErrorMessage } from './api'
import { createBackupExportArtifact, createImportSuccessMessage, type BackupSelection } from './appBackup'
import { createImportOverwriteConfirmation, type ConfirmDialogInput } from './appConfirmDialog'
import type { ImportSource } from './importData'
import { toastStore } from './toast'

export interface ImportExportState {
 importing: boolean
 exporting: boolean
 backupError: string
 backupMessage: string
}

export function createImportExportState(): ImportExportState {
 return {
  importing: false,
  exporting: false,
  backupError: '',
  backupMessage: '',
 }
}

function notifyState(
 state: ImportExportState,
 listener?: (next: ImportExportState) => void,
): void {
 listener?.({ ...state })
}

/**
 * Fetches the latest admin data, builds the backup JSON artifact, triggers a
 * file download, and sets the success/error state + toast.
 */
export async function exportDataToFile(
 state: ImportExportState,
 selection?: BackupSelection,
 onStateChange?: (next: ImportExportState) => void,
): Promise<void> {
 if (state.exporting) return

 state.backupError = ''
 state.backupMessage = ''
 state.exporting = true
 notifyState(state, onStateChange)

 try {
  const adminData = await api.admin.getData()
  const artifact = createBackupExportArtifact(adminData, Date.now(), selection)
  if (selection && artifact.payload.categories.length === 0 && artifact.payload.bookmarks.length === 0) {
   state.backupError = '请至少选择一个分类后再导出。'
   notifyState(state, onStateChange)
   return
  }
  const blob = new Blob([artifact.json], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = artifact.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
  state.backupMessage = artifact.message
  notifyState(state, onStateChange)
  toastStore.addToast(artifact.message, 'success')
 } catch (error) {
  state.backupError = getErrorMessage(error)
  notifyState(state, onStateChange)
 } finally {
  state.exporting = false
  notifyState(state, onStateChange)
 }
}

/** Dependencies that the import handler needs from the host component. */
export interface ImportDeps {
 adminData: AdminData
 requestConfirmation: (input: ConfirmDialogInput) => Promise<boolean>
 applyLoggedInData: (data: AdminData) => void
 persistCurrentAdminData: () => Promise<void>
 onStateChange?: (next: ImportExportState) => void
}

/**
 * Asynchronous import: reads the file, parses it, asks for overwrite confirmation,
 * sends to the API, then applies the result and re-persists admin data.
 */
export async function importDataFromFile(
 state: ImportExportState,
 file: File,
 source: ImportSource,
 mode: 'replace' | 'merge',
 deps: ImportDeps,
): Promise<void> {
 state.backupError = ''
 state.backupMessage = ''
 notifyState(state, deps.onStateChange)

 try {
  const text = await file.text()
  const { detectImportSource, prepareImportText } = await import('./importData')
  const detectedSource = detectImportSource(text, file.name)
  const prepared = prepareImportText(text, detectedSource || source)
  const effectiveMode = detectedSource === 'browser-html' && source !== 'browser-html' ? 'merge' : mode
  prepared.payload.mode = effectiveMode

  const confirmed = await deps.requestConfirmation(effectiveMode === 'replace'
   ? createImportOverwriteConfirmation(prepared)
   : { title: '追加导入数据', message: `将追加 ${prepared.categories} 个分类中的 ${prepared.bookmarks} 个书签，重复链接会保留。`, confirmLabel: '确认导入' })
  if (!confirmed) {
   return
  }

  state.importing = true
  notifyState(state, deps.onStateChange)
  const result = await api.data.importAll(prepared.payload)
  deps.applyLoggedInData(result.data)
  await deps.persistCurrentAdminData()
  state.backupMessage = createImportSuccessMessage(result)
  notifyState(state, deps.onStateChange)
  toastStore.addToast(state.backupMessage, 'success')
 } catch (error) {
  state.backupError = getErrorMessage(error)
  notifyState(state, deps.onStateChange)
 } finally {
  state.importing = false
  notifyState(state, deps.onStateChange)
 }
}
