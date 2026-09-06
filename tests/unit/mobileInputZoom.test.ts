import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// iOS Safari 聚焦「计算后字号 < 16px」的表单控件时会自动放大页面，
// 放大后 position: fixed 的弹窗会超出可视范围且不会自动还原。
// 这类问题在桌面浏览器的移动模拟里不会重现，只能靠源码契约兜住。
describe('mobile input zoom contracts', () => {
  const css = readFileSync('src/app.css', 'utf8')

  it('lifts touch-device form controls to 16px', () => {
    const block = css.slice(css.indexOf('@media (pointer: coarse)'))

    expect(css).toContain('@media (pointer: coarse)')
    expect(block).toContain('font-size: 16px !important')
    expect(block).toContain('textarea')
    expect(block).toContain('select')
  })

  it('leaves non-text inputs out of the override', () => {
    const block = css.slice(css.indexOf('@media (pointer: coarse)'))

    // checkbox / radio / range / color 不会触发自动放大，
    // 而且部分浏览器里它们的尺寸与字号相关，改了会意外变形
    for (const type of ['checkbox', 'radio', 'range', 'color']) {
      expect(block).toContain(`:not([type='${type}'])`)
    }
  })

  it('does not disable pinch zoom in the viewport meta', () => {
    // iOS 10 起会忽略这两个值，加了也挡不住自动放大，
    // 反而会剥夺用户正常缩放页面的能力
    const html = readFileSync('index.html', 'utf8')
    const viewport = html.slice(html.indexOf('name="viewport"'), html.indexOf('name="viewport"') + 200)

    expect(viewport).not.toContain('user-scalable=no')
    expect(viewport).not.toContain('maximum-scale=1')
  })
})
