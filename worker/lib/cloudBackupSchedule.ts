// 云端备份计划的时区换算。Workers 环境没有完整 Temporal 实现，
// 这里用 Intl.DateTimeFormat 读取目标时区的墙上时间，再反推 UTC 时间戳。

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function getZonedParts(timestamp: number, timeZone: string): ZonedParts {
  const parts = getPartsFormatter(timeZone).formatToParts(new Date(timestamp))
  const values = new Map(parts.map((part) => [part.type, part.value]))
  const hour = Number(values.get('hour') ?? '0')
  return {
    year: Number(values.get('year') ?? '1970'),
    month: Number(values.get('month') ?? '1'),
    day: Number(values.get('day') ?? '1'),
    hour: hour === 24 ? 0 : hour,
    minute: Number(values.get('minute') ?? '0'),
  }
}

function timestampForWallParts(parts: ZonedParts, timeZone: string): number {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  let candidate = desired
  // 处理夏令时偏移：最多两轮即可收敛到目标墙上时间。
  for (let round = 0; round < 2; round += 1) {
    const actual = getZonedParts(candidate, timeZone)
    const actualTimestamp = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    const timezoneOffset = actualTimestamp - candidate
    const nextCandidate = desired - timezoneOffset
    if (nextCandidate === candidate) break
    candidate = nextCandidate
  }
  return candidate
}

export function calculateNextRunAt(options: {
  enabled: boolean
  intervalHours: number
  startTime: string
  timeZone: string
  lastRunAt: number | null
  now?: number
}): number | null {
  if (!options.enabled) return null
  const now = options.now ?? Date.now()
  const intervalMs = options.intervalHours * 60 * 60 * 1000
  if (options.lastRunAt != null) return options.lastRunAt + intervalMs

  const [hourText, minuteText] = options.startTime.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const current = getZonedParts(now, options.timeZone)
  let target = { ...current, hour, minute }
  let timestamp = timestampForWallParts(target, options.timeZone)
  if (timestamp <= now) {
    target = { ...target, day: target.day + 1 }
    timestamp = timestampForWallParts(target, options.timeZone)
  }
  return timestamp
}

export function calculateNextRunAtAfterRun(options: {
  enabled: boolean
  intervalHours: number
  now: number
}): number | null {
  if (!options.enabled) return null
  return options.now + options.intervalHours * 60 * 60 * 1000
}
