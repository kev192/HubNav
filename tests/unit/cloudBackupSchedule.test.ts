import { describe, expect, it } from 'vitest'
import { calculateNextRunAt } from '../../worker/lib/cloudBackupSchedule'

describe('cloud backup schedule', () => {
  it('computes the first run in the selected timezone', () => {
    const now = Date.UTC(2026, 0, 1, 0, 30)
    expect(calculateNextRunAt({
      enabled: true,
      intervalHours: 24,
      startTime: '09:00',
      timeZone: 'Asia/Shanghai',
      lastRunAt: null,
      now,
    })).toBe(Date.UTC(2026, 0, 1, 1, 0))

    expect(calculateNextRunAt({
      enabled: true,
      intervalHours: 24,
      startTime: '08:00',
      timeZone: 'Asia/Shanghai',
      lastRunAt: null,
      now,
    })).toBe(Date.UTC(2026, 0, 2, 0, 0))
  })

  it('keeps recurrence aligned to the last run', () => {
    const now = Date.UTC(2026, 0, 3, 12, 0)
    expect(calculateNextRunAt({
      enabled: true,
      intervalHours: 6,
      startTime: '09:00',
      timeZone: 'Asia/Shanghai',
      lastRunAt: Date.UTC(2026, 0, 3, 1, 0),
      now,
    })).toBe(Date.UTC(2026, 0, 3, 19, 0))
  })

  it('returns no next run for disabled tasks', () => {
    expect(calculateNextRunAt({
      enabled: false,
      intervalHours: 24,
      startTime: '09:00',
      timeZone: 'Asia/Shanghai',
      lastRunAt: null,
      now: Date.UTC(2026, 0, 1),
    })).toBeNull()
  })
})
