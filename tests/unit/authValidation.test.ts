import { describe, expect, it } from 'vitest'
import { hashPassword } from '../../worker/lib/crypto'
import { verifyLoginCredentials } from '../../worker/lib/authValidation'

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
