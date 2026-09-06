export type BookmarkFaviconState = {
  loading: boolean
  requestId: number
  lastUrl: string
  icon: string
}

export type BookmarkFaviconTask = {
  url: string
  requestId: number
}

export function createBookmarkFaviconState(previousRequestId = 0): BookmarkFaviconState {
  return { loading: false, requestId: previousRequestId + 1, lastUrl: '', icon: '' }
}

export function normalizeFaviconLookupUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return ''
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return ''
  }
}

export function scheduleBookmarkFaviconLookup(
  state: BookmarkFaviconState,
  rawUrl: string,
): { state: BookmarkFaviconState; task: BookmarkFaviconTask | null } {
  const url = normalizeFaviconLookupUrl(rawUrl)
  if (url === state.lastUrl) return { state, task: null }

  const requestId = state.requestId + 1
  return {
    state: { ...state, loading: Boolean(url), requestId, lastUrl: url, icon: '' },
    task: url ? { url, requestId } : null,
  }
}

export function resolveBookmarkFavicon(
  state: BookmarkFaviconState,
  input: { requestId: number; icon: string },
): BookmarkFaviconState {
  if (input.requestId !== state.requestId) return state
  return { ...state, loading: false, icon: input.icon }
}

export function resolveBookmarkFaviconError(
  state: BookmarkFaviconState,
  requestId: number,
): BookmarkFaviconState {
  if (requestId !== state.requestId) return state
  return { ...state, loading: false, icon: '' }
}
