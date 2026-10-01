import { createHash } from 'node:crypto'
import { LastFMAPIError, type LastFMTrack } from './lastfm-types.ts'

export function lastfmSignature(
  parameters: Record<string, string>,
  sharedSecret: string,
): string {
  const payload =
    Object.keys(parameters)
      .filter((key) => key !== 'format' && key !== 'callback')
      .sort()
      .map((key) => key + parameters[key])
      .join('') + sharedSecret

  return createHash('md5').update(payload, 'utf8').digest('hex')
}

export class LastFMClient {
  readonly apiKey: string
  private readonly sharedSecret: string
  private static readonly baseURL = 'https://ws.audioscrobbler.com/2.0/'

  constructor(apiKey: string, sharedSecret: string) {
    this.apiKey = apiKey
    this.sharedSecret = sharedSecret
  }

  static authorizationURL(
    apiKey: string,
    token: string,
    callback?: string | null,
  ): string {
    const url = new URL('https://www.last.fm/api/auth/')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('token', token)
    if (callback) {
      url.searchParams.set('cb', callback)
    }
    return url.toString()
  }

  async requestToken(): Promise<string> {
    const response = await this.call<{ token: string }>('auth.getToken')
    return response.token
  }

  async requestSession(
    token: string,
  ): Promise<{ username: string; sessionKey: string }> {
    const response = await this.call<{
      session: { name: string; key: string }
    }>('auth.getSession', { token })
    return {
      username: response.session.name,
      sessionKey: response.session.key,
    }
  }

  async authenticatedUsername(sessionKey: string): Promise<string> {
    const response = await this.call<{ user: { name: string } }>(
      'user.getInfo',
      { sk: sessionKey },
    )
    return response.user.name
  }

  async recentTracks(
    username: string,
    sessionKey: string,
    page: number,
    limit = 200,
  ): Promise<{ tracks: LastFMTrack[]; totalPages: number }> {
    const response = await this.call<{
      recenttracks?: {
        track?:
          | Array<{
              name: string
              artist?: { '#text'?: string }
              album?: { '#text'?: string }
              '@attr'?: { nowplaying?: string }
            }>
          | {
              name: string
              artist?: { '#text'?: string }
              album?: { '#text'?: string }
              '@attr'?: { nowplaying?: string }
            }
        '@attr'?: { totalPages?: string }
      }
    }>('user.getRecentTracks', {
      user: username,
      sk: sessionKey,
      limit: String(limit),
      page: String(page),
    })

    const rawTracks = response.recenttracks?.track
    const items = Array.isArray(rawTracks)
      ? rawTracks
      : rawTracks
        ? [rawTracks]
        : []

    const tracks: LastFMTrack[] = items
      .filter((item) => item['@attr']?.nowplaying !== 'true')
      .map((item) => ({
        title: item.name,
        artist: item.artist?.['#text'] ?? '',
        album: item.album?.['#text'] || null,
      }))
      .filter((track) => track.title && track.artist)

    const totalPages = Number(response.recenttracks?.['@attr']?.totalPages) || 1

    return { tracks, totalPages }
  }

  async topTracks(
    username: string,
    sessionKey: string,
    page: number,
    period: string,
    limit = 100,
  ): Promise<{ tracks: LastFMTrack[]; totalPages: number }> {
    const response = await this.call<{
      toptracks?: {
        track?:
          | Array<{
              name: string
              artist?: { name?: string }
            }>
          | {
              name: string
              artist?: { name?: string }
            }
        '@attr'?: { totalPages?: string }
      }
    }>('user.getTopTracks', {
      user: username,
      sk: sessionKey,
      period,
      limit: String(limit),
      page: String(page),
    })

    const rawTracks = response.toptracks?.track
    const items = Array.isArray(rawTracks)
      ? rawTracks
      : rawTracks
        ? [rawTracks]
        : []

    const tracks: LastFMTrack[] = items
      .map((item) => ({
        title: item.name,
        artist: item.artist?.name ?? '',
        album: null,
      }))
      .filter((track) => track.title && track.artist)

    const totalPages = Number(response.toptracks?.['@attr']?.totalPages) || 1

    return { tracks, totalPages }
  }

  // The most popular tracks of an artist among all Last.fm listeners.
  // Needs no session.
  async artistTopTracks(artist: string, limit = 100): Promise<LastFMTrack[]> {
    const response = await this.call<{
      toptracks?: {
        track?:
          | Array<{ name: string; artist?: { name?: string } }>
          | { name: string; artist?: { name?: string } }
      }
    }>('artist.getTopTracks', {
      artist,
      autocorrect: '1',
      limit: String(limit),
    })

    const rawTracks = response.toptracks?.track
    const items = Array.isArray(rawTracks)
      ? rawTracks
      : rawTracks
        ? [rawTracks]
        : []

    return items
      .map((item) => ({
        title: item.name,
        artist: item.artist?.name ?? '',
        album: null,
      }))
      .filter((track) => track.title && track.artist)
  }

  private async call<T>(
    method: string,
    extra: Record<string, string> = {},
  ): Promise<T> {
    const parameters: Record<string, string> = {
      ...extra,
      method,
      api_key: this.apiKey,
    }
    parameters.api_sig = lastfmSignature(parameters, this.sharedSecret)
    parameters.format = 'json'

    const url = new URL(LastFMClient.baseURL)
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value)
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'shelv-web',
      },
      signal: AbortSignal.timeout(15000),
    })

    const data = (await response.json()) as
      | ({ error: number; message: string } & Record<string, unknown>)
      | T

    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'number'
    ) {
      throw new LastFMAPIError(
        data.error,
        data.message ?? 'Last.fm request failed',
      )
    }

    return data as T
  }
}
