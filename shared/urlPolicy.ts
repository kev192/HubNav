// 书签地址的协议策略，前后端共用。
//
// 书签 URL 会直接落到公开首页的 `<a href>` 上，所以 `javascript:` / `data:` 这类
// 可执行协议属于脚本注入面。当前 CSP（`script-src 'self'`）确实能挡住它们执行，
// 但把 XSS 防线全押在一条响应头上不合理：一旦为了别的功能放宽 CSP，这里就会
// 立刻变成真的存储型 XSS。所以在写入边界上就收口。
//
// 分工：Worker 侧用 `isAllowedBookmarkUrl` 做权威拒绝，前端用 `normalizeBookmarkUrl`
// 先把能救的补好，避免用户输入裸域名时撞上一条英文报错。
//
// WHATWG URL 解析器负责所有归一化工作：大小写混写（`JaVaScRiPt:`）会被小写化，
// 内嵌的制表符和换行（`java\nscript:`）会被剥掉，因此不需要自己写正则去对抗变形。

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

// URL 规范里的 scheme：字母开头，后跟字母/数字/`+`/`-`/`.`，以 `:` 结束。
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
// `host:port` 与 `scheme:path` 在语法上无法区分（`localhost:8080` 两边都成立）。
// 冒号后面全是数字时按主机端口理解——自建服务的书签常写成这样，按 scheme 处理
// 会把它们当成非法协议丢掉。
const LOOKS_LIKE_HOST_PORT = /^[^:/?#\s]+:\d+(?:[/?#]|$)/

export function isAllowedBookmarkUrl(value: unknown): value is string {
  return parseAllowedUrl(value) !== null
}

function parseAllowedUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url : null
  } catch {
    return null
  }
}

// 能救则救，救不了返回 null。
//
// 用在两处：导入（来源包括用户自己的历史备份，直接拒绝会造成数据丢失）和后台表单
// 提交（用户习惯直接敲 `example.com`）。缺协议的写法补上 `https://` 后再判定。
//
// 关键：只对「没有声明协议」的值补全。已经写明协议的（`ftp://a.com`、
// `file:///etc/passwd`）一律走原值判定后拒绝——盲目加前缀会把它们篡改成
// `https://ftp//a.com` 这种既不是原意也不可用的地址，比如实丢弃更糟。
export function normalizeBookmarkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // 本来就合法的原样保留：备份恢复后地址应该和导出时逐字节一致，不做多余重写。
  if (isAllowedBookmarkUrl(trimmed)) return trimmed
  if (HAS_SCHEME.test(trimmed) && !LOOKS_LIKE_HOST_PORT.test(trimmed)) return null

  // 补全过的值本来就是坏的，这里用解析器的规范形式输出，
  // 免得把 `//example.com` 存成 `https:////example.com`。
  return parseAllowedUrl(`https://${trimmed}`)?.href ?? null
}
