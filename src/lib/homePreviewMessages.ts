import type { Settings } from '../../shared/types'

export const HOME_PREVIEW_READY_MESSAGE = 'navhub:home-preview-ready'
export const HOME_PREVIEW_SETTINGS_MESSAGE = 'navhub:home-preview-settings'

export type HomePreviewReadyMessage = {
  type: typeof HOME_PREVIEW_READY_MESSAGE
}

export type HomePreviewSettingsMessage = {
  type: typeof HOME_PREVIEW_SETTINGS_MESSAGE
  settings: Partial<Settings>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isHomePreviewReadyMessage(value: unknown): value is HomePreviewReadyMessage {
  return isRecord(value) && value.type === HOME_PREVIEW_READY_MESSAGE
}

export function isHomePreviewSettingsMessage(value: unknown): value is HomePreviewSettingsMessage {
  return (
    isRecord(value)
    && value.type === HOME_PREVIEW_SETTINGS_MESSAGE
    && isRecord(value.settings)
  )
}
