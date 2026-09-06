export const ICON_BROWSER_CACHE_SECONDS = 7 * 24 * 60 * 60
export const ICON_EDGE_CACHE_SECONDS = 6 * 24 * 60 * 60

// Keep the shared-cache TTL shorter so an edge HIT still has browser freshness
// remaining after the response Age is applied by the client.
export const ICON_SUCCESS_CACHE =
  `public, max-age=${ICON_BROWSER_CACHE_SECONDS}, s-maxage=${ICON_EDGE_CACHE_SECONDS}, immutable`
export const ICON_FAILURE_CACHE = 'no-store'
export const ICON_FALLBACK_CACHE = 'public, max-age=300, s-maxage=300'

export function errorIconResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': ICON_FAILURE_CACHE,
    },
  })
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function fallbackIconResponse(title: string, url: string): Response {
  let hostname = 'NAV'
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '') || hostname
  } catch {
    hostname = 'NAV'
  }

  const text = escapeSvgText((title.trim() || hostname).slice(0, 4))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#111827"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#f9fafb" font-size="180" font-weight="700" font-family="Arial,Helvetica,sans-serif">${text}</text>
</svg>`

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': ICON_FALLBACK_CACHE,
      'X-Icon-Fallback': '1',
    },
  })
}

export function cacheResponse(context: unknown, request: Request, response: Response) {
  const executionCtx = (context as { executionCtx?: ExecutionContext }).executionCtx
  const edgeCache = (caches as unknown as { default: Cache }).default
  executionCtx?.waitUntil(edgeCache.put(request, response.clone()))
}

// 图标代理是匿名可访问的，而 edge cache 的键是整个请求 URL。不归一化的话
// `/api/icon/1?v=<随机>` 每次都是新键、必然 miss，于是每个请求都要走一次 D1 读取，
// 书签还没有 icon_blob 时还会额外触发一次最长 5 秒的外站抓取——不需要任何凭据
// 就能放大的资源消耗路径。
//
// 前端确实用 `?v=` 做图标更新后的缓存失效，所以不能简单丢掉整个 query：
// 保留形如版本号的 `v`，其余参数（包括超长随机串）一律并到同一个缓存条目上。
const ICON_CACHE_VERSION = /^[A-Za-z0-9_.:-]{1,64}$/

export function iconCacheKey(request: Request): Request {
  const url = new URL(request.url)
  const version = url.searchParams.get('v')
  url.search = ''
  if (version && ICON_CACHE_VERSION.test(version)) {
    url.searchParams.set('v', version)
  }
  return new Request(url.toString(), { method: 'GET' })
}

export async function getCachedResponse(request: Request): Promise<Response | undefined> {
  const edgeCache = (caches as unknown as { default: Cache }).default
  return (await edgeCache.match(request)) ?? undefined
}

export function cachedFallbackIconResponse(
  context: unknown,
  request: Request,
  title: string,
  url: string,
): Response {
  const response = fallbackIconResponse(title, url)
  cacheResponse(context, request, response)
  return response
}
