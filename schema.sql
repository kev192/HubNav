-- CF-Navs D1 schema（单用户，无 user_id）

-- 分类（栏目）
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER,                    -- NULL=一级分类，非空=所属一级分类
  title       TEXT NOT NULL,
  icon        TEXT,                       -- 图标 URL（可填 cftc 直链）
  is_private  INTEGER NOT NULL DEFAULT 0,-- 0=访客可见 1=仅登录可见
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- 书签
CREATE TABLE IF NOT EXISTS bookmarks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,             -- 站点地址
  internal_url TEXT,
  icon         TEXT,                      -- 图标 URL（cftc 直链 / 自动获取结果）
  icon_source  TEXT,                      -- 图标获取方式：direct/favicon_im/logo_surf/google/iconify/custom
  icon_background_color TEXT,             -- 单个图标背景色
  icon_blob    TEXT,                      -- 图标 base64 缓存（本地回退方案）
  description  TEXT,
  description_mode TEXT,
  open_method  INTEGER NOT NULL DEFAULT 1,-- 1=新窗口 2=当前页 3=当前页弹层
  is_private   INTEGER NOT NULL DEFAULT 0,-- 0=公开 1=仅登录可见
  sort         INTEGER NOT NULL DEFAULT 0,
  all_sort     INTEGER NOT NULL DEFAULT 0,
  click_count  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS error_report_rate_limits (
  client_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_sort ON bookmarks(category_id, sort);
CREATE INDEX IF NOT EXISTS idx_bookmarks_sort_global ON bookmarks(sort, id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_all_sort ON bookmarks(all_sort, id);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort);
CREATE INDEX IF NOT EXISTS idx_categories_sort_id ON categories(sort, id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_sort_id ON categories(parent_id, sort, id);

-- 全局设置（key-value，避免频繁改表结构）
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT                             -- JSON 字符串
);

-- 默认设置（仅当不存在时插入）
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_title', '"NavHub"'),
  ('site_title_color', '""'),
  ('site_title_font_size', '32'),
  ('public_mode', 'true'),
  ('browser_sync_enabled', 'false'),
  ('theme', '"light"'),
  ('background_preset_id', '"ocean-depths"'),
  ('background', '{"type":"gradient","value":"radial-gradient(circle at 16% 12%, rgba(56, 189, 248, 0.5), transparent 44%), radial-gradient(circle at 84% 18%, rgba(45, 212, 191, 0.42), transparent 46%), radial-gradient(circle at 52% 96%, rgba(147, 197, 253, 0.46), transparent 50%), linear-gradient(145deg, #eff9ff 0%, #e7f5fe 46%, #e9f9f8 100%)","blur":0,"mask":0.06,"maskColor":"#ffffff"}'),
  ('backgrounds', '{"light":{"type":"gradient","value":"radial-gradient(circle at 16% 12%, rgba(56, 189, 248, 0.5), transparent 44%), radial-gradient(circle at 84% 18%, rgba(45, 212, 191, 0.42), transparent 46%), radial-gradient(circle at 52% 96%, rgba(147, 197, 253, 0.46), transparent 50%), linear-gradient(145deg, #eff9ff 0%, #e7f5fe 46%, #e9f9f8 100%)","blur":0,"mask":0.06,"maskColor":"#ffffff"},"dark":{"type":"gradient","value":"radial-gradient(circle at 16% 12%, rgba(14, 165, 233, 0.44), transparent 48%), radial-gradient(circle at 84% 20%, rgba(20, 184, 166, 0.32), transparent 48%), radial-gradient(circle at 52% 96%, rgba(59, 130, 246, 0.3), transparent 54%), linear-gradient(145deg, #041828 0%, #06304a 50%, #0a2038 100%)","blur":0,"mask":0.12,"maskColor":"#000000"}}'),
  ('custom_css', '""'),
  ('custom_js', '""'),
  ('image_host_url', '""'),
  ('site_title_show', 'true'),
  ('network_mode', '"external"'),
  ('network_probe_url', '""'),
  ('most_visited_count', '8'),
  ('search_engine', '{"current":"Google","engines":[{"name":"Google","icon":"","url_template":"https://www.google.com/search?q={q}"},{"name":"Bing","icon":"","url_template":"https://www.bing.com/search?q={q}"}]}'),
  ('card_size', '{"width":80,"height":60}'),
  ('card_style', '"info"'),
  ('card_icon_size', '60'),
  ('card_show_description', 'true'),
  ('card_description_mode', '"always"'),
  ('card_background_color', '"#ffffff"'),
  ('card_background_opacity', '0.42'),
  ('card_icon_show_title', 'true'),
  ('card_text_color', '""'),
  ('search_box_show', 'true'),
  ('search_engine_selector_show', 'true'),
  ('content_layout', '{"max_width":1200,"max_width_unit":"px","margin_x":0,"margin_top":0,"margin_bottom":0}'),
  ('navigation', '{"position":"left","always_expanded":false,"top_layout":"scroll"}'),
  ('footer_html', '""');

-- 云端备份任务（S3 兼容存储；secret 保存在任务配置中，只通过后端使用）
CREATE TABLE IF NOT EXISTS cloud_backup_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  interval_hours INTEGER NOT NULL DEFAULT 24,
  start_time TEXT NOT NULL DEFAULT '00:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  retention_count INTEGER NOT NULL DEFAULT 7,
  endpoint_url TEXT NOT NULL,
  addressing_style TEXT NOT NULL DEFAULT 'path',
  bucket TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'auto',
  access_key_id TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  last_run_at INTEGER,
  next_run_at INTEGER,
  last_run_status TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_backup_tasks_next_run ON cloud_backup_tasks(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS cloud_backup_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  backup_time INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES cloud_backup_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cloud_backup_records_task_time ON cloud_backup_records(task_id, backup_time DESC);
