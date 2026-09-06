// 真实浏览器验证脚本的本地配置解析。
//
// 每个取值的优先级：环境变量 > verify.local.json > 内置默认值。
//
// verify.local.json 位于仓库根目录且被 Git 忽略。真实域名和浏览器参数只保存在那里，
// 不写进任何会提交的源码、文档或示例。管理员凭据只通过当前进程环境变量提供。
// 模板见 verify.local.example.json。

import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG_FILENAME = 'verify.local.json'
const EXAMPLE_FILENAME = 'verify.local.example.json'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const configPath = path.join(repoRoot, CONFIG_FILENAME)

let cachedConfig

function readLocalConfig() {
  if (cachedConfig !== undefined) return cachedConfig

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
    cachedConfig = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    // 文件缺失或格式错误时退回环境变量与默认值，让调用方给出可操作的提示。
    cachedConfig = {}
  }

  return cachedConfig
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

// 环境变量优先，其次读取本地配置，最后使用内置默认值。
export function resolveSetting(envName, configKey, fallback = '') {
  return readString(process.env[envName]) || readString(readLocalConfig()[configKey]) || fallback
}

function exitWithMissingTarget() {
  console.error('Missing verification target origin.')
  console.error('')
  console.error('Set BASE_URL, or create the git-ignored file in the repository root:')
  console.error(`  ${CONFIG_FILENAME}`)
  console.error('')
  console.error('  {')
  console.error('    "baseUrl": "https://your-cf-navs-domain.example"')
  console.error('  }')
  console.error('')
  console.error(`Copy ${EXAMPLE_FILENAME} for the full template.`)
  process.exit(2)
}

// 解析目标站点。故意不提供默认域名：任何默认值都会让 fork 用户或忘记配置的运行
// 意外压测别人的站点。
export function resolveBaseUrl() {
  const raw = resolveSetting('BASE_URL', 'baseUrl')
  if (!raw) {
    exitWithMissingTarget()
  }

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    console.error(`Invalid target origin: ${raw}`)
    console.error('BASE_URL must be an absolute http(s) URL, for example https://navs.example.com')
    process.exit(2)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.error(`Unsupported protocol in target origin: ${parsed.protocol}`)
    console.error('Only http and https origins can be verified.')
    process.exit(2)
  }

  return raw.replace(/\/+$/, '')
}

// 临时 Chrome profile 的父目录。默认使用当前系统的临时目录，避免把某台机器的
// 盘符写进仓库；调用方仍需保证目录名符合 cf-navs-chrome-profile-<id> 的清理约束。
export function resolveChromeProfileRoot() {
  return resolveSetting('CHROME_PROFILE_ROOT', 'chromeProfileRoot', os.tmpdir())
}

export { CONFIG_FILENAME, EXAMPLE_FILENAME }
