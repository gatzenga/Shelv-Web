// Calls the Subsonic API of Navidrome with the credentials of the browser
import { authParams } from './auth.ts'
import type { ServerConfig } from './config.ts'

type SubsonicBody = Record<string, unknown> & { status?: string }

export class SubsonicError extends Error {}

export function createClient(config: ServerConfig, params: URLSearchParams) {
  return async function request<T>(
    endpoint: string,
    query: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${config.navidromeUrl}/rest/${endpoint}`)
    for (const name of authParams) {
      const value = params.get(name)
      if (value !== null) url.searchParams.set(name, value)
    }
    url.searchParams.set('v', params.get('v') ?? '1.16.1')
    url.searchParams.set('c', params.get('c') ?? 'shelv-web')
    url.searchParams.set('f', 'json')
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value)
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
    const body = (await response.json()) as {
      'subsonic-response'?: SubsonicBody
    }
    const subsonic = body['subsonic-response']

    if (!response.ok || subsonic?.status !== 'ok') {
      throw new SubsonicError(`${endpoint} failed`)
    }

    return subsonic as T
  }
}

export type SubsonicRequest = ReturnType<typeof createClient>
