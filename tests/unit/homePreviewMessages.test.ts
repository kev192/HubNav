import { describe, expect, it } from 'vitest'
import {
  HOME_PREVIEW_READY_MESSAGE,
  HOME_PREVIEW_SETTINGS_MESSAGE,
  isHomePreviewReadyMessage,
  isHomePreviewSettingsMessage,
} from '../../src/lib/homePreviewMessages'

describe('home preview messages', () => {
  it('recognizes the ready handshake', () => {
    expect(isHomePreviewReadyMessage({ type: HOME_PREVIEW_READY_MESSAGE })).toBe(true)
    expect(isHomePreviewReadyMessage({ type: HOME_PREVIEW_SETTINGS_MESSAGE })).toBe(false)
    expect(isHomePreviewReadyMessage(null)).toBe(false)
  })

  it('recognizes settings messages without discarding partial settings', () => {
    expect(isHomePreviewSettingsMessage({
      type: HOME_PREVIEW_SETTINGS_MESSAGE,
      settings: { site_title: 'NavHub' },
    })).toBe(true)
    expect(isHomePreviewSettingsMessage({
      type: HOME_PREVIEW_SETTINGS_MESSAGE,
      settings: {},
    })).toBe(true)
    expect(isHomePreviewSettingsMessage({
      type: HOME_PREVIEW_READY_MESSAGE,
      settings: {},
    })).toBe(false)
    expect(isHomePreviewSettingsMessage({
      type: HOME_PREVIEW_SETTINGS_MESSAGE,
      settings: null,
    })).toBe(false)
  })
})
