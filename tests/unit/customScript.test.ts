import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createCustomScriptController, type CustomScriptHost } from '../../src/lib/customScript'

function createHost() {
  const elements = new Map<string, { id: string; src: string; remove: () => void }>()
  const revoked: string[] = []
  const created: string[] = []
  let nextBlobId = 0

  const host: CustomScriptHost = {
    createElement: () => {
      const node = { id: '', src: '', remove: () => elements.delete(node.id) }
      return node as unknown as HTMLScriptElement
    },
    getElementById: (id) => (elements.get(id) ?? null) as unknown as HTMLElement | null,
    appendChild: (node) => {
      elements.set(node.id, node as unknown as { id: string; src: string; remove: () => void })
    },
    createObjectUrl: (content) => {
      created.push(content)
      return `blob:https://nav.example.com/${nextBlobId++}`
    },
    revokeObjectUrl: (url) => void revoked.push(url),
  }

  return { host, elements, revoked, created }
}

describe('custom script injection', () => {
  it('loads through a blob url instead of inline text', () => {
    // 用 script.textContent 的话就是内联脚本，CSP 必须放开 'unsafe-inline'，
    // 那会连带解锁 footer_html 里的 onerror= 和 javascript: 链接。
    const { host, elements, created } = createHost()
    createCustomScriptController(host).apply('console.log(1)')

    const injected = elements.get('custom-js-inject')
    expect(injected?.src).toMatch(/^blob:/)
    expect(created).toEqual(['console.log(1)'])
    expect(injected).not.toHaveProperty('textContent')
  })

  it('does not re-run the script when the content is unchanged', () => {
    // 原实现写在 App.svelte 的大响应式块里，那个块还引用 activeTheme，
    // 于是切一次主题就把用户脚本删掉重跑一遍，监听器和定时器会不断累积。
    const { host, created } = createHost()
    const controller = createCustomScriptController(host)

    controller.apply('console.log(1)')
    controller.apply('console.log(1)')
    controller.apply('  console.log(1)  ')

    expect(created).toHaveLength(1)
  })

  it('replaces and revokes when the content actually changes', () => {
    const { host, elements, revoked, created } = createHost()
    const controller = createCustomScriptController(host)

    controller.apply('a()')
    const first = elements.get('custom-js-inject')?.src
    controller.apply('b()')

    expect(created).toEqual(['a()', 'b()'])
    expect(revoked).toEqual([first])
    expect(elements.size).toBe(1)
  })

  it('removes the script when the setting is cleared', () => {
    const { host, elements, revoked } = createHost()
    const controller = createCustomScriptController(host)

    controller.apply('a()')
    controller.apply('')

    expect(elements.size).toBe(0)
    expect(revoked).toHaveLength(1)
  })

  it('injects nothing for empty, blank, null and undefined', () => {
    const { host, elements, created } = createHost()
    const controller = createCustomScriptController(host)

    for (const value of ['', '   ', null, undefined]) {
      controller.apply(value)
    }

    expect(elements.size).toBe(0)
    expect(created).toEqual([])
  })

  it('revokes the outstanding url on destroy', () => {
    // 不 revoke 的话每次重建都会漏一个 blob URL
    const { host, elements, revoked } = createHost()
    const controller = createCustomScriptController(host)

    controller.apply('a()')
    controller.destroy()

    expect(elements.size).toBe(0)
    expect(revoked).toHaveLength(1)
  })

  it('starts clean after destroy', () => {
    const { host, created } = createHost()
    const controller = createCustomScriptController(host)

    controller.apply('a()')
    controller.destroy()
    controller.apply('a()')

    expect(created).toEqual(['a()', 'a()'])
  })

  it('tolerates a revoke that throws', () => {
    const { host } = createHost()
    const failing: CustomScriptHost = {
      ...host,
      revokeObjectUrl: vi.fn(() => {
        throw new Error('already revoked')
      }),
    }
    const controller = createCustomScriptController(failing)

    controller.apply('a()')
    expect(() => controller.apply('b()')).toThrow()
  })
})

describe('app wiring', () => {
  const source = readFileSync('src/App.svelte', 'utf8')

  it('keeps the injection out of the theme reactive block', () => {
    // 关键是 custom_js 只能出现在自己那条响应式语句里。写进上面那个块的话，
    // 它会跟着 activeTheme / homeBackgroundStyle 一起被触发。
    const occurrences = source.match(/custom_js/g) ?? []
    expect(occurrences).toHaveLength(1)
    expect(source).toContain('$: customScriptController?.apply(publicData?.settings?.custom_js)')

    const themeBlock = source.slice(
      source.indexOf("$: if (typeof document !== 'undefined')"),
      source.indexOf('$: customScriptController?.apply'),
    )
    expect(themeBlock).toContain('custom-css-inject')
    expect(themeBlock).not.toContain('custom-js-inject')
  })

  it('cleans up on destroy', () => {
    expect(source).toContain('customScriptController?.destroy()')
  })
})
