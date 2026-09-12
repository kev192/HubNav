import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('home responsive layout', () => {
  it('keeps the configurable horizontal margin desktop-only', () => {
    const home = readFileSync('src/views/Home.svelte', 'utf8')
    const mobileStyles = home.slice(home.indexOf('@media (max-width: 799px)'))

    expect(home).toContain('padding: 1.5rem calc(1.5rem + var(--content-margin-x, 0px))')
    expect(mobileStyles).toContain('padding: 1rem 1rem var(--content-margin-bottom, 0%);')
    expect(mobileStyles).not.toContain('var(--content-margin-x')
  })
  it('compacts the mobile top action row and category bar without changing desktop layout', () => {
    const actions = readFileSync('src/components/HomeFloatingActions.svelte', 'utf8').replace(/\r\n/g, '\n')
    const sidebar = readFileSync('src/components/Sidebar.svelte', 'utf8').replace(/\r\n/g, '\n')
    const home = readFileSync('src/views/Home.svelte', 'utf8').replace(/\r\n/g, '\n')
    const mobileActions = actions.slice(actions.indexOf('@media (max-width: 799px)'))
    const mobileSidebar = sidebar.slice(sidebar.indexOf('@media (max-width: 799px)'))
    const mobileHome = home.slice(home.indexOf('@media (max-width: 799px)'))

    expect(mobileActions).toContain('top: .65rem;')
    expect(mobileActions).toContain('.network-switch .icon-button {\n      width: 1.88rem;')
    expect(mobileActions).toContain('.floating-actions .icon-button {\n      width: 1.76rem;')
    expect(mobileSidebar).toContain('top: 3.68rem;')
    expect(mobileSidebar).toContain('height: 2.4rem;')
    expect(mobileSidebar).toContain('font-size: 0.7rem;')
    expect(mobileHome).toContain('padding-top: 6.96rem;')

    const submenuStart = sidebar.indexOf('  .top-submenu {')
    const submenuEnd = sidebar.indexOf('  .top-submenu button {', submenuStart)
    const submenu = sidebar.slice(submenuStart, submenuEnd)
    expect(submenu).toContain('background: rgb(var(--card-bg-rgb, 255 255 255) / 1);')
    expect(submenu).toContain('backdrop-filter: none;')

    // 桌面端仍使用原有尺寸，避免移动端压缩规则反向影响宽屏。
    expect(sidebar.slice(0, sidebar.indexOf('@media (max-width: 799px)'))).toContain('height: 52px;')
    expect(actions.slice(0, actions.indexOf('@media (max-width: 799px)'))).toContain('width: 2.5rem;')
  })

  it('paints the scrolled top navigation strip with the active theme background', () => {
    const sidebar = readFileSync('src/components/Sidebar.svelte', 'utf8').replace(/\r\n/g, '\n')
    const ruleStart = sidebar.indexOf('  .top-navigation::before {')
    const ruleEnd = sidebar.indexOf('  .top-track {', ruleStart)
    const rule = sidebar.slice(ruleStart, ruleEnd)

    expect(rule).toContain('var(--home-background,')
    expect(rule).toContain('var(--home-background-mask-color,')
    expect(rule).toContain('var(--home-background-mask,')
    expect(rule).toContain('background-attachment: fixed;')
    expect(rule).not.toContain('background: rgb(var(--card-bg-rgb, 255 255 255) / 1);')
  })

  it('paints mobile overscroll with the active homepage background', () => {
    const app = readFileSync('src/App.svelte', 'utf8')
    const globalStyles = readFileSync('src/app.css', 'utf8')

    expect(app).toContain("'--home-background'")
    expect(app).toContain("'--home-background-mask'")
    expect(app).toContain("'--home-background-mask-color'")
    expect(app).toContain('document.documentElement.style.setProperty')
    expect(globalStyles).toContain('var(--home-background);')
    expect(globalStyles).toContain('background-attachment: fixed;')
  })
})
