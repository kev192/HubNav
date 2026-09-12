import { describe, expect, it } from 'vitest'
import { BOOKMARK_IMPORT_CHUNK_SIZE, CATEGORY_IMPORT_CHUNK_SIZE } from '../../worker/lib/db/import'
import { chunkImportRows, normalizeImportCategory, normalizeImportBookmark, remapImportRecords } from '../../worker/lib/db/importHelpers'
import type { Bookmark, Category } from '../../shared/types'

describe('normalizeImportCategory', () => {
  const now = 1700000000000

  it('preserves the private flag when importing a private category', () => {
    const input: Category = {
      id: 1,
      title: 'Private tools',
      icon: '/icon.svg',
      is_private: 1,
      sort: 3,
      created_at: 100,
    }
    const output = normalizeImportCategory(input, now)

    expect(output.is_private).toBe(true)
  })

  it('does not invent a private flag for legacy categories', () => {
    const input: Category = { id: 2, title: 'Legacy', icon: null, sort: 0, created_at: 100 }
    const output = normalizeImportCategory(input, now)

    expect(output).not.toHaveProperty('is_private')
  })

  it('defaults null icon to null', () => {
    const input: Category = { id: 2, title: 'Empty', icon: null, sort: 0, created_at: 0 }
    const output = normalizeImportCategory(input, now)

    expect(output.icon).toBeNull()
  })

  it('defaults missing or NaN sort to 0', () => {
    const input: Category = { id: 3, title: 'Bad', icon: null, sort: NaN, created_at: 0 }
    const output = normalizeImportCategory(input, now)

    expect(output.sort).toBe(0)
  })

  it('defaults missing sort (undefined) to 0', () => {
    const input = { id: 4, title: 'NoSort', icon: null, created_at: 0 } as unknown as Category
    const output = normalizeImportCategory(input, now)

    expect(output.sort).toBe(0)
  })

  it('falls back to now when created_at is falsy', () => {
    const input: Category = { id: 5, title: 'Fresh', icon: null, sort: 1, created_at: 0 }
    const output = normalizeImportCategory(input, now)

    expect(output.created_at).toBe(now)
  })


  it('keeps negative sort if finite', () => {
    const input: Category = { id: 6, title: 'Neg', icon: null, sort: -5, created_at: 50 }
    const output = normalizeImportCategory(input, now)

    expect(output.sort).toBe(-5)
  })
})

describe('category import batching', () => {
  it('keeps 15 categories within the 100-parameter D1 statement limit', () => {
    const chunks = chunkImportRows(Array.from({ length: 15 }, (_, id) => ({ id })), CATEGORY_IMPORT_CHUNK_SIZE)

    expect(CATEGORY_IMPORT_CHUNK_SIZE * 7).toBeLessThanOrEqual(100)
    expect(chunks.map((chunk) => chunk.length)).toEqual([14, 1])
  })
})
describe('bookmark import batching', () => {
  it('keeps every bookmark statement within the 100-parameter D1 limit', () => {
    const chunks = chunkImportRows(Array.from({ length: 16 }, (_, id) => ({ id })), BOOKMARK_IMPORT_CHUNK_SIZE)

    expect(BOOKMARK_IMPORT_CHUNK_SIZE * 17).toBeLessThanOrEqual(100)
    expect(chunks.map((chunk) => chunk.length)).toEqual([5, 5, 5, 1])
  })
})

describe('normalizeImportBookmark', () => {
  const now = 1700000000000

  const base: Bookmark = {
    id: 1,
    category_id: 10,
    title: 'GitHub',
    url: 'https://github.com',
    internal_url: 'http://192.168.1.10',
    click_count: 7,
    icon: 'https://favicon.im/github.com',
    icon_source: 'favicon_im' as const,
    icon_background_color: '#333',
    icon_blob: null,
    description: 'Code host',
    description_mode: null,
    open_method: 1,
    sort: 5,
    created_at: 100,
  }

  it('passes through well-formed bookmarks', () => {
    const output = normalizeImportBookmark(base, now)
    expect(output).toEqual(base)
  })

  it('clamps open_method 1/2/3 correctly', () => {
    expect(normalizeImportBookmark({ ...base, open_method: 1 }, now).open_method).toBe(1)
    expect(normalizeImportBookmark({ ...base, open_method: 2 }, now).open_method).toBe(2)
    expect(normalizeImportBookmark({ ...base, open_method: 3 }, now).open_method).toBe(3)
    // Everything else maps to 1
    expect(normalizeImportBookmark({ ...base, open_method: 0 as 1 | 2 | 3 }, now).open_method).toBe(1)
    expect(normalizeImportBookmark({ ...base, open_method: 4 as 1 | 2 | 3 }, now).open_method).toBe(1)
    expect(normalizeImportBookmark({ ...base, open_method: 99 as 1 | 2 | 3 }, now).open_method).toBe(1)
  })

  it('defaults null icon to null', () => {
    const output = normalizeImportBookmark({ ...base, icon: null }, now)
    expect(output.icon).toBeNull()
  })

  it('defaults missing optional fields to null', () => {
    const stripped = {
      id: 2,
      category_id: 10,
      title: 'Stripped',
      url: 'https://example.com',
      icon: null,
      open_method: 1 as 1 | 2 | 3,
      sort: 0,
      created_at: 0,
    } as unknown as Bookmark

    const output = normalizeImportBookmark(stripped, now)

    expect(output.description).toBeNull()
    expect(output.icon_source).toBeNull()
    expect(output.icon_background_color).toBeNull()
    expect(output.icon_blob).toBeNull()
    expect(output.internal_url).toBeNull()
    expect(output.click_count).toBe(0)
  })

  it('defaults NaN sort to 0', () => {
    const output = normalizeImportBookmark({ ...base, sort: NaN }, now)
    expect(output.sort).toBe(0)
  })

  it('preserves the homepage-wide all_sort value', () => {
    expect(normalizeImportBookmark({ ...base, all_sort: 19 }, now).all_sort).toBe(19)
    expect(normalizeImportBookmark({ ...base, all_sort: null }, now).all_sort).toBeNull()
    expect(normalizeImportBookmark({ ...base }, now)).not.toHaveProperty('all_sort')
  })

  it('falls back to now when created_at is falsy', () => {
    const output = normalizeImportBookmark({ ...base, created_at: 0 }, now)
    expect(output.created_at).toBe(now)
  })

  it('keeps explicit sort, icon, internal address, and click count', () => {
    const output = normalizeImportBookmark(base, now)
    expect(output.sort).toBe(5)
    expect(output.icon_source).toBe('favicon_im')
    expect(output.icon_background_color).toBe('#333')
    expect(output.description).toBe('Code host')
    expect(output.internal_url).toBe('http://192.168.1.10')
    expect(output.click_count).toBe(7)
  })

  it('sanitizes invalid click counts without losing the internal address', () => {
    const output = normalizeImportBookmark({ ...base, click_count: -3.8 }, now)

    expect(output.internal_url).toBe('http://192.168.1.10')
    expect(output.click_count).toBe(0)
  })
})

describe('remapImportRecords', () => {
  it('inserts roots before children and rewrites parent and bookmark category ids', () => {
    const result = remapImportRecords([
      { id: 10, parent_id: 20, title: 'Child', icon: null, sort: 0, created_at: 1 },
      { id: 20, parent_id: null, title: 'Root', icon: null, sort: 0, created_at: 1 },
    ], [{
      id: 30,
      category_id: 10,
      title: 'Bookmark',
      url: 'https://bookmark.test',
      icon: null,
      icon_source: null,
      icon_background_color: null,
      icon_blob: null,
      description: null,
      description_mode: null,
      open_method: 1,
      sort: 0,
      created_at: 1,
    }], 100)

    expect(result.categories.map((category) => ({ id: category.id, parent_id: category.parent_id, title: category.title }))).toEqual([
      { id: 1, parent_id: null, title: 'Root' },
      { id: 2, parent_id: 1, title: 'Child' },
    ])
    expect(result.bookmarks[0].category_id).toBe(2)
    expect(result.categoryIdMap).toEqual(new Map([[20, 1], [10, 2]]))
  })
})
