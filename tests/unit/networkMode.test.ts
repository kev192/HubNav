import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NETWORK_MODE_CHANGE_EVENT,
  ensureEffectiveNetworkMode,
  getCachedNetworkProbeMode,
  getEffectiveNetworkMode,
  getNetworkMode,
  probeNetworkMode,
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
  probeUrl = '',
}: {
  mode?: string | null
  resolved?: string | null
  probeUrl?: string
} = {}) {
  const storage = new Map<string, string>()
  if (mode != null) storage.set('navhub-network-mode', mode)
  if (resolved != null) storage.set('navhub-network-resolved', resolved)
  const localStorageLike: StorageLike = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  const dataset: Record<string, string> = { networkProbeUrl: probeUrl }
  const dispatchEvent = vi.fn()
  vi.stubGlobal('localStorage', localStorageLike)
  vi.stubGlobal('document', { documentElement: { dataset } })
  vi.stubGlobal('window', { dispatchEvent })

  return { storage, dataset, dispatchEvent }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

describe('fast auto network probing', () => {
  it('uses a short HEAD no-store probe so unreachable LAN hosts fail quickly', () => {
    const source = readFileSync('src/lib/networkMode.ts', 'utf8')

    expect(source).toContain('NETWORK_PROBE_TIMEOUT_MS = 700')
    expect(source).toContain("method: 'HEAD'")
    expect(source).toContain("mode: 'no-cors'")
    expect(source).toContain("cache: 'no-store'")
  })

  it('returns non-auto modes without probing', async () => {
    setupBrowserState({ mode: 'internal' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await ensureEffectiveNetworkMode()).toBe('internal')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reuses a fresh cached probe result', async () => {
    setupBrowserState({ mode: 'auto', probeUrl: 'http://nas.local/' })
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await probeNetworkMode({ url: 'http://nas.local/', force: true })).toBe('internal')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getCachedNetworkProbeMode('http://nas.local/')).toBe('internal')

    fetchMock.mockClear()
    expect(await ensureEffectiveNetworkMode('http://nas.local/')).toBe('internal')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shares one pending probe with an auto-mode bookmark click', async () => {
    setupBrowserState({ mode: 'auto', probeUrl: 'http://nas-pending.local/' })
    const pending = deferred<Response>()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)

    const first = ensureEffectiveNetworkMode('http://nas-pending.local/')
    const second = ensureEffectiveNetworkMode('http://nas-pending.local/')
    pending.resolve(new Response(null, { status: 204 }))

    expect(await first).toBe('internal')
    expect(await second).toBe('internal')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('bookmark card network mode wiring', () => {
  it('renders the network-aware URL into every clickable anchor', () => {
    const card = readFileSync('src/components/BookmarkCard.svelte', 'utf8')
    const info = readFileSync('src/components/BookmarkCardInfo.svelte', 'utf8')
    const compact = readFileSync('src/components/BookmarkCardCompact.svelte', 'utf8')

    expect(card).toContain('bookmarkUrl={selectedBookmarkUrl}')
    expect(card).toContain('ensureEffectiveNetworkMode()')
    expect(card).not.toContain('void resolveBookmarkUrl().then(openBookmarkUrl)')
    expect(info.match(/href=\{preview \? undefined : bookmarkUrl \|\| bookmark\.url\}/g)).toHaveLength(1)
    expect(compact.match(/href=\{preview \? undefined : bookmarkUrl \|\| bookmark\.url\}/g)).toHaveLength(2)
  })

  it('reacts to mode changes and pre-probes the configured URL', () => {
    const card = readFileSync('src/components/BookmarkCard.svelte', 'utf8')
    const actions = readFileSync('src/components/HomeFloatingActions.svelte', 'utf8')
    const home = readFileSync('src/views/Home.svelte', 'utf8')

    expect(card).toContain('window.addEventListener(NETWORK_MODE_CHANGE_EVENT, handleNetworkModeChanged)')
    expect(actions).toContain('setNetworkMode(nextMode)')
    expect(actions).toContain('setResolvedNetworkMode')
    expect(actions).toContain('getCachedNetworkProbeMode(networkProbeUrl)')
    expect(actions).toContain("probeNetworkMode({ url: networkProbeUrl, force: true })")
    expect(actions).toContain("networkProbeUrl !== lastAutoProbeUrl")
    expect(home).toContain("networkProbeUrl={settings?.network_probe_url ?? ''}")
  })
})
