// 后台「自定义 JS」的注入。
//
// 为什么不用 `script.textContent`：那按规范属于内联脚本，要跑起来就必须给 CSP 加
// `script-src 'unsafe-inline'`，而那会连带放开 footer_html 里的 `onerror=`、
// `javascript:` 链接和任意内联 `<script>` —— 为了一个设置项赔上整条 XSS 防线。
//
// 改用 blob URL + `script.src`，CSP 只需要 `script-src 'self' blob:`。
// 关键区别：要拿到一个 blob URL 必须先调用 URL.createObjectURL，也就是**已经能执行
// 脚本了**。只能注入 HTML 的攻击者没有这个能力（blob 的 UUID 不可猜、只在创建它的
// 文档上下文里有效，而且我们加载完立刻 revoke），所以 `blob:` 对他们零收益。
//
// 另一件事是生命周期。原实现写在 App.svelte 的大响应式块里，那个块还引用了
// activeTheme、homeBackgroundStyle，于是**每次切换主题、每次数据刷新都会把脚本
// 删掉重新执行一遍**，事件监听和定时器会不断累积。之前 CSP 拦着，这个 bug 一直
// 潜伏；改成真的能执行之后必须先修掉。这里用 lastSource 做幂等：内容没变就什么都不做。

const SCRIPT_ELEMENT_ID = 'custom-js-inject'

export interface CustomScriptHost {
  createElement: (tagName: 'script') => HTMLScriptElement
  getElementById: (id: string) => HTMLElement | null
  appendChild: (node: HTMLScriptElement) => void
  createObjectUrl: (content: string) => string
  revokeObjectUrl: (url: string) => void
}

export interface CustomScriptController {
  apply: (source: string | null | undefined) => void
  destroy: () => void
}

export function createBrowserCustomScriptHost(): CustomScriptHost {
  return {
    createElement: (tagName) => document.createElement(tagName),
    getElementById: (id) => document.getElementById(id),
    appendChild: (node) => document.body.appendChild(node),
    createObjectUrl: (content) => URL.createObjectURL(new Blob([content], { type: 'text/javascript' })),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  }
}

export function createCustomScriptController(host: CustomScriptHost): CustomScriptController {
  // undefined 表示「还没应用过」，用来区分首次的空内容和一次真正的清空。
  let lastSource: string | undefined
  let objectUrl: string | null = null

  function removeCurrent(): void {
    host.getElementById(SCRIPT_ELEMENT_ID)?.remove()
    if (objectUrl) {
      host.revokeObjectUrl(objectUrl)
      objectUrl = null
    }
  }

  return {
    apply(source) {
      const next = (source ?? '').trim()
      // 幂等：内容没变就不重建，否则切个主题都会让用户的脚本再跑一次。
      if (lastSource === next) return
      lastSource = next

      removeCurrent()
      if (!next) return

      objectUrl = host.createObjectUrl(next)
      const script = host.createElement('script')
      script.id = SCRIPT_ELEMENT_ID
      script.src = objectUrl
      host.appendChild(script)
    },
    destroy() {
      removeCurrent()
      lastSource = undefined
    },
  }
}
