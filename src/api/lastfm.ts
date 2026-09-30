import { getBackendUrl } from '@/api/httpClient'

export type LastFMConnectionState =
  | 'notConfigured'
  | 'notConnected'
  | 'checking'
  | 'connected'
  | 'failed'

export type LastFMConnectionProblem =
  | 'invalidAPIKey'
  | 'invalidSecret'
  | 'accessRevoked'
  | 'authorizationIncomplete'
  | 'unreachable'
  | { other: string }

export interface LastFMStatus {
  isConfigured: boolean
  state: LastFMConnectionState
  username: string | null
  problem: LastFMConnectionProblem | null
  lastChecked: string | null
}

export interface LastFMLogsResponse {
  entries: string[]
}

export async function getLastFMStatus(): Promise<LastFMStatus> {
  const res = await fetch(getBackendUrl('/api/lastfm/status'), {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch Last.fm status')
  return res.json()
}

export async function verifyLastFMConnection(): Promise<LastFMStatus> {
  const res = await fetch(getBackendUrl('/api/lastfm/verify'), {
    method: 'POST',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to verify Last.fm connection')
  return res.json()
}

export async function disconnectLastFM(): Promise<LastFMStatus> {
  const res = await fetch(getBackendUrl('/api/lastfm/disconnect'), {
    method: 'POST',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to disconnect from Last.fm')
  return res.json()
}

export async function beginLastFMAuth(callbackUrl?: string): Promise<{
  token: string
  authUrl: string
}> {
  const query = callbackUrl ? { callback: callbackUrl } : undefined
  const res = await fetch(getBackendUrl('/api/lastfm/auth/begin', query), {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to begin Last.fm authorization')
  return res.json()
}

export async function completeLastFMAuth(
  token: string,
): Promise<{ success: boolean } & LastFMStatus> {
  const res = await fetch(
    getBackendUrl('/api/lastfm/auth/complete', { token }),
    {
      method: 'POST',
      cache: 'no-store',
    },
  )
  if (!res.ok) throw new Error('Failed to complete Last.fm authorization')
  return res.json()
}

export async function getLastFMLogs(): Promise<string[]> {
  const res = await fetch(getBackendUrl('/api/lastfm/logs'), {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch Last.fm logs')
  const data = (await res.json()) as LastFMLogsResponse
  return data.entries
}

export async function clearLastFMLogs(): Promise<void> {
  const res = await fetch(getBackendUrl('/api/lastfm/logs/clear'), {
    method: 'POST',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to clear Last.fm logs')
}
