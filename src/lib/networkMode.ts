export const NETWORK_MODE_CHANGE_EVENT = 'navhub-network-mode-change'

export type NetworkMode = 'external' | 'internal' | 'auto'
export type EffectiveNetworkMode = 'external' | 'internal'

type BookmarkUrlFields = {
  url: string
  internal_url?: string | null
}

const NETWORK_MODES: readonly NetworkMode[] = ['external', 'internal', 'auto']
const EFFECTIVE_NETWORK_MODES: readonly EffectiveNetworkMode[] = ['external', 'internal']

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
 * Read the user-selected mode. localStorage is authoritative because the
 * switch is a per-browser preference; the data attribute is the server-side
 * default/fallback used during the first render.
 */
export function getNetworkMode(): NetworkMode {
  const stored = readStorage('navhub-network-mode')
  if (isNetworkMode(stored)) return stored

  const datasetMode = typeof document !== 'undefined'
    ? document.documentElement.dataset.networkMode ?? null
    : null
  return isNetworkMode(datasetMode) ? datasetMode : 'external'
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
