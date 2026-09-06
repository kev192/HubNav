// 新增书签时自动解析站点名称的纯状态机。
// 与 bookmarkIconifyController 同构：requestId 单调递增防竞态、lastUrl 去重。
// 因为由网址输入框失焦触发，不需要 debounce，所以没有定时器。

import { truncateUnicodeText } from './truncateUnicodeText'

// 自动填充的内容会直接落进标题输入框，太长会撑出可视范围、不好修改。
// 与后台列表、访问分析里的截断长度保持一致。
export const BOOKMARK_TITLE_FILL_MAX_LENGTH = 20

export type BookmarkTitleState = {
  loading: boolean
  error: string
  requestId: number
  lastUrl: string
}

export type BookmarkTitleLookupTask = {
  url: string
  requestId: number
}

export type BookmarkTitleScheduleResult = {
  state: BookmarkTitleState
  changed: boolean
  task: BookmarkTitleLookupTask | null
}

export type BookmarkTitleResolveResult = {
  state: BookmarkTitleState
  title: string | null
}

// 弹窗是单例、只切 open，所以 onDestroy 不会在两次使用之间触发。重置必须让 requestId
// 越过上一轮在途请求的编号：仅仅沿用同一个值的话，那个响应回来时仍会匹配上并写入新表单。
export function createBookmarkTitleState(previousRequestId = 0): BookmarkTitleState {
  return {
    loading: false,
    error: '',
    requestId: previousRequestId + 1,
    lastUrl: '',
  }
}

// 只有「看起来能抓」的地址才值得发请求：必须是 http(s)、有主机名，且主机名带点号
// （排除 localhost、intranet 这类填一半或抓不到的值）。
export function normalizeTitleLookupUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (!url.hostname || !url.hostname.includes('.')) return ''
    // 不要把内嵌的账号密码放进查询串发给自己的 Worker。
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return ''
  }
}

export function scheduleBookmarkTitleLookup(
  state: BookmarkTitleState,
  input: { mode: 'create' | 'edit'; url: string; title: string },
): BookmarkTitleScheduleResult {
  const skipped: BookmarkTitleScheduleResult = { state, changed: false, task: null }

  // 编辑已有书签时绝不自动改标题。
  if (input.mode !== 'create') return skipped
  // 标题已有内容时不发请求，省掉一次注定不会写入的往返。
  if (input.title.trim()) return skipped

  const url = normalizeTitleLookupUrl(input.url)
  if (!url) return skipped
  // 同一个地址重复失焦不重复请求。
  if (url === state.lastUrl) return skipped

  const requestId = state.requestId + 1
  return {
    state: {
      loading: true,
      error: '',
      requestId,
      lastUrl: url,
    },
    changed: true,
    task: { url, requestId },
  }
}

export function resolveBookmarkTitleSuccess(
  state: BookmarkTitleState,
  input: { requestId: number; title: string; currentTitle: string },
): BookmarkTitleResolveResult {
  // 过期响应：期间用户已经换过地址。
  if (input.requestId !== state.requestId) {
    return { state, title: null }
  }

  const nextState: BookmarkTitleState = { ...state, loading: false, error: '' }
  const title = truncateUnicodeText(input.title.trim(), BOOKMARK_TITLE_FILL_MAX_LENGTH)
  // 请求在途期间用户自己打了标题 —— 「仅为空时填」策略的最后一道防线。
  if (!title || input.currentTitle.trim()) {
    return { state: nextState, title: null }
  }

  return { state: nextState, title }
}

export function resolveBookmarkTitleError(
  state: BookmarkTitleState,
  input: { requestId: number; error: string },
): BookmarkTitleState {
  if (input.requestId !== state.requestId) return state

  return {
    ...state,
    loading: false,
    error: input.error,
  }
}
