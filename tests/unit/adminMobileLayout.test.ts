import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('admin mobile layout contracts', () => {
  it('keeps the page header actions in normal document flow', () => {
    const header = readFileSync('src/components/admin/AdminPageHeader.svelte', 'utf8')
    const mobileHeader = header.slice(header.indexOf('@media (max-width: 700px)'))

    expect(header.indexOf('<header class="page-header">')).toBeLessThan(header.indexOf('class="admin-header-actions"'))
    expect(header).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(mobileHeader).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(mobileHeader).toContain('padding: 10px 12px')
    expect(mobileHeader).toContain('width: 2rem')
    expect(header).not.toContain('position: fixed')

    const sidebar = readFileSync('src/components/AdminSidebar.svelte', 'utf8')
    expect(sidebar).toContain('top: auto')

    const admin = readFileSync('src/views/Admin.svelte', 'utf8')
    const narrowAdminPage = admin.slice(admin.indexOf('@media (max-width: 720px)'))
    expect(narrowAdminPage).toContain('padding-bottom: calc(76px + env(safe-area-inset-bottom))')
  })

  it('keeps mobile status metrics in one three-column row', () => {
    const styles = readFileSync('src/components/admin/adminListPanels.css', 'utf8')
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 960px)'))

    expect(mobileStyles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(mobileStyles).toContain('min-width: 0')
  })

  it('provides compact bookmark metadata and preserves full values accessibly', () => {
    const bookmarks = readFileSync('src/components/admin/BookmarkListPanel.svelte', 'utf8')

    expect(bookmarks).toContain('import { truncateUnicodeText }')
    expect(bookmarks).toContain('truncateUnicodeText(bookmark.title, 12)')
    expect(bookmarks).toContain('class="admin-bookmark-meta"')
    expect(bookmarks).toContain('class="admin-bookmark-mobile-url"')
    expect(bookmarks).toContain('title={bookmark.title}')
    expect(bookmarks).toContain('title={bookmark.url}')
    expect(bookmarks).toContain('min-width: 0')
    expect(bookmarks).toContain('width: 144px !important')
    expect(bookmarks).toContain('.admin-bookmark-table .col-open_method')
  })

  it('bounds zero-visit title and URL display without changing link targets', () => {
    const analytics = readFileSync('src/components/admin/AnalyticsPanel.svelte', 'utf8')

    expect(analytics).toContain('truncateUnicodeText(bookmark.title, 20)')
    expect(analytics).toContain('truncateUnicodeText(bookmark.url, 20)')
    expect(analytics).toContain('href={bookmark.url}')
    expect(analytics).toContain('title={bookmark.url}')
    expect(analytics).toContain('overflow: hidden')
  })

  it('removes the settings helper description and grids mobile import controls', () => {
    const settings = readFileSync('src/components/SettingsPanel.svelte', 'utf8')
    const backup = readFileSync('src/components/BackupPanel.svelte', 'utf8')

    expect(settings).not.toContain('class="panel-desc"')
    expect(backup).toContain('grid-template-areas:')
    expect(backup).toContain('"source source"')
    expect(backup).toContain('"mode button"')
    expect(backup).toContain('minmax(0, 1fr)')
  })
})
