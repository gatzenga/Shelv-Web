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
  readBody,
  sendBuffer,
  sendJson,
  sendText,
} from './http.ts'
import { logger } from './logger.ts'
import { parseRadioSettings, RadioSettingsStore } from './radio-settings.ts'
import {
  azuraCastNowPlaying,
  emptyIcyNowPlaying,
  icyNowPlaying,
  type NowPlaying,
  resolveStream,
  userAgent,
} from './radio-source.ts'
import {
  pipeRadioUpstream,
  type RadioUpstreamResponse,
  readRadioUpstreamBuffer,
  readRadioUpstreamText,
  requestRadioUpstream,
} from './radio-upstream.ts'
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

function hasSameHost(address: string, other: string | null | undefined) {
  try {
    return Boolean(other) && new URL(address).host === new URL(other ?? '').host
  } catch {
    return false
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

// lan: the playlist is in the home network, so what it names may be as well.
// A playlist from the internet may never send the backend into the home network.
function hlsProxyUrl(
  stationId: string,
  src: string,
  expiresAt: number,
  lan: boolean,
) {
  const params = new URLSearchParams({
    id: stationId,
    src,
    exp: String(expiresAt),
    lan: lan ? '1' : '0',
    sig: sign(`hls|${stationId}|${src}|${expiresAt}|${lan ? 1 : 0}`),
  })

  return `/api/radio/hls?${params}`
}

function artworkProxyUrl(src: string, revision: string, lan: boolean) {
  const params = new URLSearchParams({
    src,
    lan: lan ? '1' : '0',
    sig: sign(`art|${src}|${lan ? 1 : 0}`),
    rev: revision,
  })

  return `/api/radio/art?${params}`
}

// --- what is passed on ------------------------------------------------------
// The links of the segments and of the artwork work without a login, and what
// comes back from a foreign server must not run as a page of this app. So only
// audio and pictures keep their type, anything else is a plain download, and
// the answer may not do anything on its own.

const streamTypes =
  /^(audio\/|video\/|application\/(ogg|mp4|octet-stream|vnd\.apple\.mpegurl|x-mpegurl|mpegurl)|binary\/octet-stream)/
const pictureTypes = /^image\/(png|jpeg|jpg|gif|webp|avif|bmp)$/

function safeType(value: string | string[] | undefined, allowed: RegExp) {
  const type = (Array.isArray(value) ? value[0] : value)?.toLowerCase().trim()

  return type && allowed.test(type) ? type : 'application/octet-stream'
}

function copyRadioHeaders(
  res: ServerResponse,
  upstream: RadioUpstreamResponse,
) {
  copyNodeUpstreamHeaders(res, upstream.headers)
  res.setHeader(
    'content-type',
    safeType(upstream.headers['content-type'], streamTypes),
  )
  res.removeHeader('content-disposition')
}

function forbidActiveContent(res: ServerResponse) {
  res.setHeader('content-security-policy', "default-src 'none'; sandbox")
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

function rewritePlaylist(
  text: string,
  baseUrl: string,
  stationId: string,
  lan: boolean,
) {
  const expiresAt = Date.now() + hlsUrlLifetime
  const proxied = (uri: string) =>
    hlsProxyUrl(stationId, new URL(uri, baseUrl).toString(), expiresAt, lan)

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
    allowPrivate?: boolean,
  ) {
    try {
      const upstream = await requestRadioUpstream(src, {
        headers: {
          'user-agent': browserUserAgent(req),
          'accept-encoding': 'identity',
        },
        signal: abortOnClose(res),
        allowPrivate,
      })
      const rawContentType = upstream.headers['content-type']
      const contentType =
        (Array.isArray(rawContentType)
          ? rawContentType[0]
          : rawContentType
        )?.toLowerCase() ?? ''

      if (!upstream.ok || !isPlaylist(contentType, src)) {
        copyRadioHeaders(res, upstream)
        await pipeRadioUpstream(req, res, upstream)
        return
      }

      const text = await readRadioUpstreamText(upstream, 1024 * 1024)
      const playlist = rewritePlaylist(
        text,
        upstream.url || src,
        stationId,
        upstream.allowPrivate,
      )

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
      copyRadioHeaders(res, upstream)
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
    const lan = url.searchParams.get('lan') === '1'
    const signature = url.searchParams.get('sig')

    const isValid =
      expiresAt > Date.now() &&
      hasValidSignature(
        `hls|${stationId}|${src}|${expiresAt}|${lan ? 1 : 0}`,
        signature,
      )

    if (!isValid) {
      sendJson(res, 403, { error: 'invalid or expired link' })
      return
    }

    await serveHlsResource(req, res, stationId, src, lan)
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
      // the picture on the host of the AzuraCast API may be where that host is
      const apiUrl = settings?.useAzuraCastApi ? settings.apiUrl : null
      nowPlaying.artworkUrl = artworkProxyUrl(
        nowPlaying.artworkUrl,
        artworkRevision(nowPlaying),
        hasSameHost(nowPlaying.artworkUrl, apiUrl),
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
    const lan = url.searchParams.get('lan') === '1'

    if (
      !hasValidSignature(
        `art|${src}|${lan ? 1 : 0}`,
        url.searchParams.get('sig'),
      )
    ) {
      sendJson(res, 403, { error: 'invalid link' })
      return
    }

    const upstream = await requestRadioUpstream(src, {
      headers: {
        'user-agent': browserUserAgent(req),
        'accept-encoding': 'identity',
      },
      signal: abortOnClose(res),
      // the host of the AzuraCast API, is in the home network or not, and
      // the picture may be where it is. Any other host: only the internet.
      allowPrivate: lan ? undefined : false,
    })
    const contentType = safeType(upstream.headers['content-type'], pictureTypes)

    if (!upstream.ok || !pictureTypes.test(contentType)) {
      upstream.body.resume()
      sendJson(res, 404, { error: 'no artwork' })
      return
    }

    // a picture is small, a server that never stops is not a picture
    sendBuffer(
      req,
      res,
      await readRadioUpstreamBuffer(upstream, 8 * 1024 * 1024),
      contentType,
    )
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

    // what is passed on from a foreign server can not run as a page of this app
    forbidActiveContent(res)

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
