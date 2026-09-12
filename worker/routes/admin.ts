import { Hono } from 'hono'
import { ErrCode, type AdminData } from '../../shared/types'
import { getAdminData, getDataVersion, getSettings, listBookmarks, listCategories } from '../lib/db'
import { shouldBypassRequestCache } from '../lib/requestCache'
import { fail, ok } from '../lib/response'
import { getCachedAdminData, setCachedAdminData } from '../lib/runtimeCache'
import type { HonoEnv } from '../types'

export const adminRoutes = new Hono<HonoEnv>()

adminRoutes.get('/data', async (c) => {
  try {
    const bypassCache = shouldBypassRequestCache(c.req.header('Cache-Control'), c.req.header('Pragma'))
    if (!bypassCache) {
      const cached = getCachedAdminData()
      if (cached) {
        return c.json(ok(cached), 200, {
          'Cache-Control': 'no-store',
        })
      }
    }

    const data = {
      ...await getAdminData(c.env.DB),
      version: await getDataVersion(c.env.DB),
    }
    if (!bypassCache) {
      setCachedAdminData(data)
    }

    return c.json(ok(data), 200, {
      'Cache-Control': 'no-store',
    })
  } catch {
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to load admin data'))
  }
})

// 后台常规聚合会省略 icon_blob 以降低管理页传输量；本地备份导出需要
// 与云端备份相同的数据源，因此单独提供包含完整图标缓存的数据。
adminRoutes.get('/export-data', async (c) => {
  try {
    const [categories, bookmarks, settings] = await Promise.all([
      listCategories(c.env.DB),
      listBookmarks(c.env.DB),
      getSettings(c.env.DB),
    ])

    return c.json(ok<AdminData>({ categories, bookmarks, settings }), 200, {
      'Cache-Control': 'no-store',
    })
  } catch {
    return c.json(fail(ErrCode.SERVER_ERROR, 'failed to load backup export data'))
  }
})

export default adminRoutes
