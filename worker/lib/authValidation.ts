import type { AdminCredentials } from './bootstrap'
import { verifyPassword } from './crypto'

export interface LoginCredentialInput {
  username?: string
  password?: string
}

function normalizeUsername(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase()
}

/**
 * Verify administrator login credentials without changing password semantics.
 * Usernames are normalized for common input-manager/full-width variants, while
 * the password remains an exact, byte-for-byte comparison.
 */
export async function verifyLoginCredentials(
  input: LoginCredentialInput,
  credentials: AdminCredentials,
): Promise<boolean> {
  const username = typeof input.username === 'string' ? input.username : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const expectedUsername = typeof credentials.username === 'string' ? credentials.username : ''

  if (!username.trim() || !password) return false

  const usernameMatches = normalizeUsername(username) === normalizeUsername(expectedUsername)
  if (!usernameMatches) return false

  return verifyPassword(password, credentials.passwordHash)
}
