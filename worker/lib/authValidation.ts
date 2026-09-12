import type { AdminCredentials } from './bootstrap'
import { verifyPassword } from './crypto'

export interface LoginCredentialInput {
  username?: string
  password?: string
}

function normalizeUsername(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase()
}

export type LoginCredentialFailureReason = 'blank_input' | 'username_mismatch' | 'password_mismatch'

export interface LoginCredentialCheckResult {
  ok: boolean
  reason?: LoginCredentialFailureReason
}

/**
 * Verify administrator login credentials without changing password semantics.
 * Usernames are normalized for common input-manager/full-width variants, while
 * the password remains an exact, byte-for-byte comparison.
 */
export async function inspectLoginCredentials(
  input: LoginCredentialInput,
  credentials: AdminCredentials,
): Promise<LoginCredentialCheckResult> {
  const username = typeof input.username === 'string' ? input.username : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const expectedUsername = typeof credentials.username === 'string' ? credentials.username : ''

  if (!username.trim() || !password) {
    return { ok: false, reason: 'blank_input' }
  }

  const usernameMatches = normalizeUsername(username) === normalizeUsername(expectedUsername)
  if (!usernameMatches) {
    return { ok: false, reason: 'username_mismatch' }
  }

  const passwordMatches = await verifyPassword(password, credentials.passwordHash)
  return passwordMatches ? { ok: true } : { ok: false, reason: 'password_mismatch' }
}

export async function verifyLoginCredentials(
  input: LoginCredentialInput,
  credentials: AdminCredentials,
): Promise<boolean> {
  return (await inspectLoginCredentials(input, credentials)).ok
}
