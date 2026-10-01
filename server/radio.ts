// Radio streams, metadata and artwork, all tunneled through the backend,
// so the browser only ever talks to this container (no CORS, no mixed content).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { authParams, credentialsKey } from './auth.ts'
import type { ServerConfig } from './config.ts'
import {
  abortOnClose,
  copyNodeUpstreamHeaders,
  pipeUpstream,
  readBody,
  sendJson,
  sendText,
} from './http.ts'
import { logger } from './logger.ts'
import {
  pipeRadioUpstream,
  readRadioUpstreamText,
  requestRadioUpstream,
} from './radio-upstream.ts'
import { parseRadioSettings, RadioSettingsStore } from './radio-settings.ts'
import {
  azuraCastNowPlaying,
  emptyIcyNowPlaying,
  icyNowPlaying,
  type NowPlaying,
  resolveStream,
  userAgent,
} from './radio-source.ts'
import { TtlCache } from './ttl-cache.ts'

interface Station {
  id: string
  name: string
  streamUrl: string
}

interface StationsResponse {
  'subsonic-response'?: {
    status?: string
    internetRadioStations?: {
      internetRadioStation?: { id: string; name: string; streamUrl: string }[]
    }
  }
}

function browserUserAgent(req: IncomingMessage) {
  const value = req.headers['user-agent']
  return typeof value === 'string' && value ? value : userAgent
}

// --- signed URLs ----------------------------------------------------------
// HLS segments and artwork are fetched by the browser without credentials.
// Only URLs this backend wrote into a playlist or a now playing response are
// accepted, so it can not be used as an open proxy.

const signingKey = randomBytes(32)
const hlsUrlLifetime = 6 * 60 * 60 * 1000

function sign(value: string) {
  return createHmac('sha256', signingKey).update(value).digest('base64url')
}

function hasValidSignature(value: string, signature: string | null) {
  if (!signature) return false

  const expected = Buffer.from(sign(value))
  const actual = Buffer.from(signature)

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function hlsProxyUrl(stationId: string, src: string, expiresAt: number) {
  const params = new URLSearchParams({
    id: stationId,
    src,
    exp: String(expiresAt),
    sig: sign(`hls|${stationId}|${src}|${expiresAt}`),
  })

  return `/api/radio/hls?${params}`
}

function artworkProxyUrl(src: string, revision: string) {
  const params = new URLSearchParams({
    src,
    sig: sign(`art|${src}`),
    rev: revision,
  })

  return `/api/radio/art?${params}`
}

// Shelv: RadioNowPlayingMetadata.artworkRevisionToken. The station art URL
// of AzuraCast stays the same for every song, so the token makes the
// browser reload it whenever the song changes.
function artworkRevision(nowPlaying: NowPlaying) {
  const seed = [
    nowPlaying.artworkUrl,
    nowPlaying.stationName,
    nowPlaying.title,
    nowPlaying.artist,
    nowPlaying.album,
  ]
    .map((part) => part?.trim().toLowerCase() ?? '')
    .join('|')

  return createHmac('sha256', 'artwork').update(seed).digest('hex').slice(0, 12)
}

// --- HLS playlist rewriting -------------------------------------------------

function isPlaylist(contentType: string, url: string) {
  return (
    contentType.includes('mpegurl') ||
    /\.m3u8?($|\?)/i.test(new URL(url).pathname)
  )
}

function rewritePlaylist(text: string, baseUrl: string, stationId: string) {
  const expiresAt = Date.now() + hlsUrlLifetime
  const proxied = (uri: string) =>
    hlsProxyUrl(stationId, new URL(uri, baseUrl).toString(), expiresAt)

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      // Tags like #EXT-X-KEY, #EXT-X-MAP or #EXT-X-MEDIA carry URI="..."
      if (trimmed.startsWith('#')) {
        return line.replace(
          /URI="([^"]+)"/g,
          (_, uri: string) => `URI="${proxied(uri)}"`,
        )
      }

      return proxied(trimmed)
    })
    .join('\n')
}

// --- handler ----------------------------------------------------------------

export function createRadioHandler(config: ServerConfig) {
  const stationLists = new TtlCache<Station[] | null>()
  const settingsStore = new RadioSettingsStore(
    join(config.configDir, 'azuracast.json'),
  )

  // The station list is requested with the credentials of the browser,
  // which also authenticates every radio request against Navidrome
  function stationsFor(params: URLSearchParams) {
    return stationLists.getOrLoad(
      credentialsKey(params),
      (stations) => (stations ? 10000 : 5000),
      async () => {
        const url = new URL(
          `${config.navidromeUrl}/rest/getInternetRadioStations`,
        )
        for (const name of authParams) {
          const value = params.get(name)
          if (value !== null) url.searchParams.set(name, value)
        }
        url.searchParams.set('v', params.get('v') ?? '1.16.1')
        url.searchParams.set('c', params.get('c') ?? 'shelv-web')
        url.searchParams.set('f', 'json')

        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) return null

        const body = (await response.json()) as StationsResponse
        const subsonic = body['subsonic-response']
        if (subsonic?.status !== 'ok') return null

        return subsonic.internetRadioStations?.internetRadioStation ?? []
      },
    )
  }

  async function findStation(url: URL, res: ServerResponse) {
    const id = url.searchParams.get('id')
    let stations = await stationsFor(url.searchParams)
    let station = stations?.find((item) => item.id === id)

    // a station created a moment ago is not in the cached list yet
    if (stations && !station) {
      stationLists.delete(credentialsKey(url.searchParams))
      stations = await stationsFor(url.searchParams)
      station = stations?.find((item) => item.id === id)
    }

    if (!stations) {
      sendJson(res, 401, { error: 'unauthorized' })
      return null
    }

    if (!station) {
      sendJson(res, 404, { error: 'station not found' })
      return null
    }

    return station
  }

  async function serveHlsResource(
    req: IncomingMessage,
    res: ServerResponse,
    stationId: string,
    src: string,
  ) {
    try {
      const upstream = await requestRadioUpstream(src, {
        headers: {
          'user-agent': browserUserAgent(req),
          'accept-encoding': 'identity',
        },
        signal: abortOnClose(res),
      })
      const rawContentType = upstream.headers['content-type']
      const contentType =
        (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType)
          ?.toLowerCase() ?? ''

      if (!upstream.ok || !isPlaylist(contentType, src)) {
        copyNodeUpstreamHeaders(res, upstream.headers)
        await pipeRadioUpstream(req, res, upstream)
        return
      }

      const text = await readRadioUpstreamText(upstream, 1024 * 1024)
      const playlist = rewritePlaylist(text, upstream.url || src, stationId)

      res.setHeader('cache-control', 'no-cache')
      sendText(res, 200, playlist, 'application/vnd.apple.mpegurl')
    } catch (error) {
      logger.error(`GET /api/radio/hls upstream failed (${src})`, error)
      throw error
    }
  }

  async function handleStream(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    const station = await findStation(url, res)
    if (!station) return

    const stream = await resolveStream(station.streamUrl)

    if (stream.kind === 'hls') {
      await serveHlsResource(req, res, station.id, stream.url)
      return
    }

    try {
      const upstream = await requestRadioUpstream(stream.url, {
        headers: {
          'icy-metadata': '0',
          'user-agent': browserUserAgent(req),
          'accept-encoding': 'identity',
        },
        signal: abortOnClose(res),
      })

      res.setHeader('cache-control', 'no-store')
      copyNodeUpstreamHeaders(res, upstream.headers)
      await pipeRadioUpstream(req, res, upstream, { live: true })
    } catch (error) {
      logger.error(
        `GET /api/radio/stream upstream failed (${stream.url}, station ${station.id})`,
        error,
      )
      throw error
    }
  }

  async function handleHls(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    const stationId = url.searchParams.get('id') ?? ''
    const src = url.searchParams.get('src') ?? ''
    const expiresAt = Number(url.searchParams.get('exp'))
    const signature = url.searchParams.get('sig')

    const isValid =
      expiresAt > Date.now() &&
      hasValidSignature(`hls|${stationId}|${src}|${expiresAt}`, signature)

    if (!isValid) {
      sendJson(res, 403, { error: 'invalid or expired link' })
      return
    }

    await serveHlsResource(req, res, stationId, src)
  }

  async function handleProbe(res: ServerResponse, url: URL) {
    const station = await findStation(url, res)
    if (!station) return

    const stream = await resolveStream(station.streamUrl)

    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, { kind: stream.kind })
  }

  async function handleNowPlaying(res: ServerResponse, url: URL) {
    const station = await findStation(url, res)
    if (!station) return

    const stream = await resolveStream(station.streamUrl)
    const settings = await settingsStore.get(station.id)

    let nowPlaying: NowPlaying

    // Like in the Shelv player only a station set up for it uses the AzuraCast API
    if (settings?.useAzuraCastApi && settings.apiUrl) {
      nowPlaying = { ...(await azuraCastNowPlaying(settings.apiUrl)) }
      if (!settings.showSongCover) nowPlaying.artworkUrl = null
    } else if (stream.kind === 'hls') {
      // HLS carries no ICY metadata, only the station name is shown
      nowPlaying = emptyIcyNowPlaying()
    } else {
      nowPlaying = { ...(await icyNowPlaying(stream.url)) }
    }

    if (nowPlaying.artworkUrl) {
      nowPlaying.artworkUrl = artworkProxyUrl(
        nowPlaying.artworkUrl,
        artworkRevision(nowPlaying),
      )
    }

    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, nowPlaying)
  }

  async function handleSettings(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    res.setHeader('cache-control', 'no-store')

    // Only users of the Navidrome server may read or change the settings
    if (req.method === 'GET') {
      const stations = await stationsFor(url.searchParams)
      if (!stations) {
        sendJson(res, 401, { error: 'unauthorized' })
        return
      }

      sendJson(res, 200, await settingsStore.all())
      return
    }

    const id = url.searchParams.get('id') ?? ''
    const stations = await stationsFor(url.searchParams)
    if (!stations) {
      sendJson(res, 401, { error: 'unauthorized' })
      return
    }

    // A station created a moment ago is not in the cached list yet. Removing
    // the settings of a station that is gone is fine as well.
    if (req.method === 'DELETE') {
      await settingsStore.set(id, null)
      sendJson(res, 200, { ok: true })
      return
    }

    let body: unknown
    try {
      body = JSON.parse(await readBody(req, 16 * 1024))
    } catch {
      sendJson(res, 400, { error: 'invalid body' })
      return
    }

    const settings = parseRadioSettings(body)
    if (!id || !settings) {
      sendJson(res, 400, { error: 'invalid settings' })
      return
    }

    await settingsStore.set(id, settings)
    sendJson(res, 200, settings)
  }

  async function handleArtwork(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    const src = url.searchParams.get('src') ?? ''

    if (!hasValidSignature(`art|${src}`, url.searchParams.get('sig'))) {
      sendJson(res, 403, { error: 'invalid link' })
      return
    }

    const upstream = await fetch(src, {
      headers: {
        'user-agent': browserUserAgent(req),
        'accept-encoding': 'identity',
      },
      signal: abortOnClose(res),
    })
    const contentType = upstream.headers.get('content-type') ?? ''

    if (!upstream.ok || !contentType.startsWith('image/')) {
      upstream.body?.cancel().catch(() => {})
      sendJson(res, 404, { error: 'no artwork' })
      return
    }

    await pipeUpstream(req, res, upstream)
  }

  return async function handleRadio(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    if (url.pathname === '/api/radio/settings') {
      if (!['GET', 'PUT', 'DELETE'].includes(req.method ?? '')) {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }

      return handleSettings(req, res, url)
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }

    switch (url.pathname) {
      case '/api/radio/stream':
        return handleStream(req, res, url)
      case '/api/radio/hls':
        return handleHls(req, res, url)
      case '/api/radio/probe':
        return handleProbe(res, url)
      case '/api/radio/nowplaying':
        return handleNowPlaying(res, url)
      case '/api/radio/art':
        return handleArtwork(req, res, url)
      default:
        sendJson(res, 404, { error: 'not found' })
    }
  }
}
