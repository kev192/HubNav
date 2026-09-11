import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NETWORK_MODE_CHANGE_EVENT,
  getEffectiveNetworkMode,
  getNetworkMode,
  resolveBookmarkUrl,
  setNetworkMode,
  setResolvedNetworkMode,
} from '../../src/lib/networkMode'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function setupBrowserState({
  mode,
  resolved,
}: {
  mode?: string | null
  resolved?: string | null
} = {}) {
  const storage = new Map<string, string>()
  if (mode != null) storage.set('navhub-network-mode', mode)
  if (resolved != null) storage.set('navhub-network-resolved', resolved)
  const localStorageLike: StorageLike = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  const dataset: Record<string, string> = {}
  const dispatchEvent = vi.fn()
  vi.stubGlobal('localStorage', localStorageLike)
  vi.stubGlobal('document', { documentElement: { dataset } })
  vi.stubGlobal('window', { dispatchEvent })

  return { storage, dataset, dispatchEvent }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('network mode URL selection', () => {
  it('uses the internal URL only in effective internal mode', () => {
    const bookmark = {
      url: 'https://example.com',
      internal_url: '  http://192.168.1.10:8123  ',
    }

    expect(resolveBookmarkUrl(bookmark, 'external')).toBe('https://example.com')
    expect(resolveBookmarkUrl(bookmark, 'internal')).toBe('http://192.168.1.10:8123')
  })

  it('falls back to the external URL when the internal URL is blank', () => {
    expect(resolveBookmarkUrl({
      url: 'https://example.com',
      internal_url: '   ',
    }, 'internal')).toBe('https://example.com')
  })

  it('resolves auto mode from the latest successful probe', () => {
    setupBrowserState({ mode: 'auto', resolved: 'internal' })
    expect(getEffectiveNetworkMode()).toBe('internal')
    expect(resolveBookmarkUrl({
      url: 'https://example.com',
      internal_url: 'http://nas.local',
    })).toBe('http://nas.local')
  })

  it('falls back to the server default when local storage has an invalid value', () => {
    const { dataset } = setupBrowserState({ mode: 'not-a-mode' })
    dataset.networkMode = 'internal'
    expect(getNetworkMode()).toBe('internal')
  })

  it('notifies bookmark cards whenever the selected mode changes', () => {
    const { storage, dataset, dispatchEvent } = setupBrowserState()

    setNetworkMode('internal')
    expect(storage.get('navhub-network-mode')).toBe('internal')
    expect(dataset.networkMode).toBe('internal')
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: NETWORK_MODE_CHANGE_EVENT }),
    )

    setResolvedNetworkMode('internal')
    expect(storage.get('navhub-network-resolved')).toBe('internal')
    expect(dataset.networkResolvedMode).toBe('internal')
  })
})

describe('bookmark card network mode wiring', () => {
  it('renders the network-aware URL into every clickable anchor', () => {
    const card = readFileSync('src/components/BookmarkCard.svelte', 'utf8')
    const info = readFileSync('src/components/BookmarkCardInfo.svelte', 'utf8')
    const compact = readFileSync('src/components/BookmarkCardCompact.svelte', 'utf8')

    expect(card).toContain('bookmarkUrl={selectedBookmarkUrl}')
    expect(card).toContain("resolveBookmarkUrl(bookmark)")
    expect(card).not.toContain('void resolveBookmarkUrl().then(openBookmarkUrl)')
    expect(info.match(/href=\{preview \? undefined : bookmarkUrl \|\| bookmark\.url\}/g)).toHaveLength(1)
    expect(compact.match(/href=\{preview \? undefined : bookmarkUrl \|\| bookmark\.url\}/g)).toHaveLength(2)
  })

  it('reacts to mode changes and probes auto mode after settings load', () => {
    const card = readFileSync('src/components/BookmarkCard.svelte', 'utf8')
    const actions = readFileSync('src/components/HomeFloatingActions.svelte', 'utf8')
    const home = readFileSync('src/views/Home.svelte', 'utf8')

    expect(card).toContain("window.addEventListener(NETWORK_MODE_CHANGE_EVENT, handleNetworkModeChanged)")
    expect(actions).toContain('setNetworkMode(nextMode)')
    expect(actions).toContain('setResolvedNetworkMode')
    expect(actions).toContain("networkProbeUrl !== lastAutoProbeUrl")
    expect(home).toContain('networkProbeUrl={settings?.network_probe_url ?? \'\'}')
  })
})
