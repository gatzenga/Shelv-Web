import { createHash } from 'node:crypto'

// Cached responses are served without asking Navidrome, so the credentials
// of such a request are checked once against Navidrome and then remembered.
const verifiedTtl = 10 * 60 * 1000
const maxEntries = 1000
const verified = new Map<string, number>()

export const authParams = ['u', 't', 's', 'p', 'apiKey']

export function credentialsKey(params: URLSearchParams) {
  const parts = authParams.map((name) => `${name}=${params.get(name) ?? ''}`)

  return createHash('sha256').update(parts.join('&')).digest('hex')
}

export async function verifyCredentials(
  navidromeUrl: string,
  params: URLSearchParams,
): Promise<boolean> {
  const hasCredentials = params.has('apiKey') || params.has('u')
  if (!hasCredentials) return false

  const key = credentialsKey(params)
  const expiresAt = verified.get(key)

  if (expiresAt && expiresAt > Date.now()) return true

  const ping = new URL(`${navidromeUrl}/rest/ping`)
  for (const name of authParams) {
    const value = params.get(name)
    if (value !== null) ping.searchParams.set(name, value)
  }
  ping.searchParams.set('v', params.get('v') ?? '1.16.1')
  ping.searchParams.set('c', params.get('c') ?? 'shelv-web')
  ping.searchParams.set('f', 'json')

  try {
    const response = await fetch(ping)
    if (!response.ok) return false

    const body = (await response.json()) as {
      'subsonic-response'?: { status?: string }
    }
    const isValid = body['subsonic-response']?.status === 'ok'

    if (isValid) {
      if (verified.size >= maxEntries) verified.clear()
      verified.set(key, Date.now() + verifiedTtl)
    }

    return isValid
  } catch {
    return false
  }
}
