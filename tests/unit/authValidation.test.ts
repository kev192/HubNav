import { describe, expect, it } from 'vitest'
import { hashPassword } from '../../worker/lib/crypto'
import { inspectLoginCredentials, verifyLoginCredentials } from '../../worker/lib/authValidation'

describe('administrator login credential validation', () => {
  it('accepts equivalent username casing and full-width input', async () => {
    const passwordHash = await hashPassword('correct horse battery staple')

    expect(await verifyLoginCredentials(
      { username: '  ＡＤＭＩｎ  ', password: 'correct horse battery staple' },
      { username: 'admin', passwordHash },
    )).toBe(true)
  })

  it('compares passwords exactly, including whitespace', async () => {
    const passwordHash = await hashPassword('correct horse battery staple')

    expect(await verifyLoginCredentials(
      { username: 'admin', password: ' correct horse battery staple ' },
      { username: 'admin', passwordHash },
    )).toBe(false)
  })

  it('reports a non-sensitive mismatch reason for login diagnostics', async () => {
    const passwordHash = await hashPassword('correct horse battery staple')

    expect(await inspectLoginCredentials(
      { username: 'other-admin', password: 'correct horse battery staple' },
      { username: 'admin', passwordHash },
    )).toEqual({ ok: false, reason: 'username_mismatch' })
    expect(await inspectLoginCredentials(
      { username: 'admin', password: 'wrong password' },
      { username: 'admin', passwordHash },
    )).toEqual({ ok: false, reason: 'password_mismatch' })
  })

  it('rejects a blank username or password before password verification', async () => {
    const passwordHash = await hashPassword('correct horse battery staple')

    expect(await verifyLoginCredentials(
      { username: ' ', password: 'correct horse battery staple' },
      { username: 'admin', passwordHash },
    )).toBe(false)
    expect(await verifyLoginCredentials(
      { username: 'admin', password: '' },
      { username: 'admin', passwordHash },
    )).toBe(false)
  })
})
