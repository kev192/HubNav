import { describe, expect, it } from 'vitest'
import { calculateNextRunAt, calculateNextRunAtAfterRun } from '../../worker/lib/cloudBackupSchedule'

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

  it('anchors recurrence to the last run plus the configured interval', () => {
    const now = Date.UTC(2026, 0, 3, 12, 0)
    expect(calculateNextRunAt({
      enabled: true,
      intervalHours: 6,
      startTime: '09:00',
      timeZone: 'Asia/Shanghai',
      lastRunAt: Date.UTC(2026, 0, 3, 1, 0),
      now,
    })).toBe(Date.UTC(2026, 0, 3, 7, 0))
  })

  it('reschedules from the actual manual or scheduled run time', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0)
    expect(calculateNextRunAtAfterRun({
      enabled: true,
      intervalHours: 3,
      now,
    })).toBe(Date.UTC(2026, 0, 1, 13, 0))

    expect(calculateNextRunAtAfterRun({
      enabled: false,
      intervalHours: 3,
      now,
    })).toBeNull()
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
