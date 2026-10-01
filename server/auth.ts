import { createHash } from 'node:crypto'

// Cached responses are served without asking Navidrome, so the credentials
// of such a request are checked once against Navidrome and then remembered.
const verifiedTtl = 10 * 60 * 1000
const maxEntries = 1000
// Navidrome that does not answer must not hold the requests up for long
const requestTimeout = 8000
const verified = new Map<string, number>()

export const authParams = ['u', 't', 's', 'p', 'apiKey']

export function credentialsKey(params: URLSearchParams) {
  const parts = authParams.map((name) => params.get(name) ?? '')

  return createHash('sha256').update(JSON.stringify(parts)).digest('hex')
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
    const response = await fetch(ping, {
      signal: AbortSignal.timeout(requestTimeout),
    })
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

// Changing the settings of the whole server (lyrics database, Last.fm,
// radio settings) is for administrators of Navidrome only
const admins = new Map<string, number>()

export async function verifyAdmin(
  navidromeUrl: string,
  params: URLSearchParams,
): Promise<boolean> {
  const username = params.get('u')
  if (!username || !(await verifyCredentials(navidromeUrl, params))) {
    return false
  }

  const key = credentialsKey(params)
  const expiresAt = admins.get(key)
  if (expiresAt && expiresAt > Date.now()) return true

  const request = new URL(`${navidromeUrl}/rest/getUser`)
  for (const name of authParams) {
    const value = params.get(name)
    if (value !== null) request.searchParams.set(name, value)
  }
  request.searchParams.set('username', username)
  request.searchParams.set('v', params.get('v') ?? '1.16.1')
  request.searchParams.set('c', params.get('c') ?? 'shelv-web')
  request.searchParams.set('f', 'json')

  try {
    const response = await fetch(request, {
      signal: AbortSignal.timeout(requestTimeout),
    })
    if (!response.ok) return false

    const body = (await response.json()) as {
      'subsonic-response'?: { status?: string; user?: { adminRole?: boolean } }
    }
    const subsonic = body['subsonic-response']
    const isAdmin =
      subsonic?.status === 'ok' && subsonic.user?.adminRole === true

    if (isAdmin) {
      if (admins.size >= maxEntries) admins.clear()
      admins.set(key, Date.now() + verifiedTtl)
    }

    return isAdmin
  } catch {
    return false
  }
}
