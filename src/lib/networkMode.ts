export const NETWORK_MODE_CHANGE_EVENT = 'navhub-network-mode-change'

export type NetworkMode = 'external' | 'internal' | 'auto'
export type EffectiveNetworkMode = 'external' | 'internal'

type BookmarkUrlFields = {
  url: string
  internal_url?: string | null
}

type NetworkProbeState = {
  url: string
  mode: EffectiveNetworkMode
  probedAt: number
}

const NETWORK_MODES: readonly NetworkMode[] = ['external', 'internal', 'auto']
const EFFECTIVE_NETWORK_MODES: readonly EffectiveNetworkMode[] = ['external', 'internal']
const NETWORK_PROBE_TIMEOUT_MS = 700
const NETWORK_PROBE_FRESH_MS = 10_000

let networkProbeState: NetworkProbeState | null = null
let pendingNetworkProbe: { url: string; promise: Promise<EffectiveNetworkMode> } | null = null

function isNetworkMode(value: string | null): value is NetworkMode {
  return Boolean(value && NETWORK_MODES.includes(value as NetworkMode))
}

function isEffectiveNetworkMode(value: string | null): value is EffectiveNetworkMode {
  return Boolean(value && EFFECTIVE_NETWORK_MODES.includes(value as EffectiveNetworkMode))
}

function readStorage(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private/embedded browser contexts.
  }
}

/**
 * Read the current mode. App.svelte writes the data attribute according to
 * the current authentication state, so it must win over a stale preference
 * while a visitor is using the page. The stored value remains the fallback
 * for the administrator preference before the app has initialized.
 */
export function getNetworkMode(): NetworkMode {
  const datasetMode = typeof document !== 'undefined'
    ? document.documentElement.dataset.networkMode ?? null
    : null
  if (isNetworkMode(datasetMode)) return datasetMode

  const stored = readStorage('navhub-network-mode')
  return isNetworkMode(stored) ? stored : 'external'
}

/** Resolve `auto` to the result of the most recent network probe. */
export function getEffectiveNetworkMode(): EffectiveNetworkMode {
  const mode = getNetworkMode()
  if (mode !== 'auto') return mode

  const storedResolved = readStorage('navhub-network-resolved')
  if (isEffectiveNetworkMode(storedResolved)) return storedResolved

  const datasetResolved = typeof document !== 'undefined'
    ? document.documentElement.dataset.networkResolvedMode ?? null
    : null
  return isEffectiveNetworkMode(datasetResolved) ? datasetResolved : 'external'
}

/** Select the URL at the last possible moment, immediately before navigation. */
export function resolveBookmarkUrl(
  bookmark: BookmarkUrlFields,
  effectiveMode: EffectiveNetworkMode = getEffectiveNetworkMode(),
): string {
  const internalUrl = bookmark.internal_url?.trim()
  return effectiveMode === 'internal' && internalUrl ? internalUrl : bookmark.url
}

export function notifyNetworkModeChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NETWORK_MODE_CHANGE_EVENT))
  }
}

export function setNetworkMode(mode: NetworkMode): void {
  writeStorage('navhub-network-mode', mode)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.networkMode = mode
  }
  notifyNetworkModeChanged()
}

export function setResolvedNetworkMode(mode: EffectiveNetworkMode): void {
  writeStorage('navhub-network-resolved', mode)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.networkResolvedMode = mode
  }
  notifyNetworkModeChanged()
}

function readProbeUrl(fallbackUrl?: string): string {
  const explicitUrl = fallbackUrl?.trim()
  if (explicitUrl) return explicitUrl
  if (typeof document === 'undefined') return ''
  return document.documentElement.dataset.networkProbeUrl?.trim() ?? ''
}

export function getCachedNetworkProbeMode(
  url?: string,
  maxAgeMs = NETWORK_PROBE_FRESH_MS,
): EffectiveNetworkMode | null {
  const probeUrl = readProbeUrl(url)
  if (!networkProbeState || networkProbeState.url !== probeUrl) return null
  if (Date.now() - networkProbeState.probedAt > maxAgeMs) return null
  return networkProbeState.mode
}

async function fetchNetworkProbe(url: string): Promise<EffectiveNetworkMode> {
  if (typeof fetch === 'undefined') return 'external'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_PROBE_TIMEOUT_MS)
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    return 'internal'
  } catch {
    // A local probe must fail fast. Waiting for the browser's full timeout
    // makes the first bookmark click after switching to auto use a stale URL.
    return 'external'
  } finally {
    clearTimeout(timer)
  }
}

export async function probeNetworkMode(options: {
  url?: string
  force?: boolean
} = {}): Promise<EffectiveNetworkMode> {
  const url = readProbeUrl(options.url)
  if (!url) {
    setResolvedNetworkMode('external')
    return 'external'
  }

  if (!options.force) {
    const cached = getCachedNetworkProbeMode(url)
    if (cached) return cached
  }

  if (pendingNetworkProbe?.url === url) return pendingNetworkProbe.promise

  const promise = fetchNetworkProbe(url)
    .then((mode) => {
      networkProbeState = { url, mode, probedAt: Date.now() }
      setResolvedNetworkMode(mode)
      return mode
    })
    .finally(() => {
      if (pendingNetworkProbe?.promise === promise) pendingNetworkProbe = null
    })

  pendingNetworkProbe = { url, promise }
  return promise
}

/**
 * A bookmark click in auto mode waits for an in-flight probe, but never for a
 * slow browser timeout. This keeps the first click correct while still routing
 * in well under a second for a reachable LAN address.
 */
export async function ensureEffectiveNetworkMode(url?: string): Promise<EffectiveNetworkMode> {
  const mode = getNetworkMode()
  if (mode !== 'auto') return mode

  const probeUrl = readProbeUrl(url)
  if (pendingNetworkProbe?.url === probeUrl) return pendingNetworkProbe.promise

  const cached = getCachedNetworkProbeMode(probeUrl)
  if (cached) return cached

  return probeNetworkMode({ url: probeUrl, force: true })
}
