// Everything the backend has to find out about a radio stream:
// what kind of stream it is, and where its now playing metadata comes from.
// The metadata logic follows the Shelv player (RadioMetadataService.swift).
import { TtlCache } from './ttl-cache.ts'

export const userAgent = 'Shelv Web'

const minute = 60 * 1000

// --- stream kind --------------------------------------------------------

export interface ResolvedStream {
  kind: 'hls' | 'direct'
  url: string
}

const resolvedStreams = new TtlCache<ResolvedStream>()

function timeout(ms: number, signal?: AbortSignal) {
  const timer = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([timer, signal]) : timer
}

async function readText(response: Response, maxBytes: number) {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  return Buffer.concat(chunks).toString('utf8')
}

function firstUrl(lines: string[], baseUrl: string) {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    try {
      return new URL(trimmed, baseUrl).toString()
    } catch {}
  }

  return null
}

// Station URLs are often not the stream itself: HLS master playlists,
// or .pls/.m3u files that only point to the real Icecast/Shoutcast stream.
async function detectStream(
  url: string,
  depth: number,
): Promise<ResolvedStream> {
  if (depth > 3) return { kind: 'direct', url }

  const response = await fetch(url, {
    headers: { 'icy-metadata': '0', 'user-agent': userAgent },
    signal: timeout(10000),
  })
  const finalUrl = response.url || url
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const looksLikeAudio =
    (contentType.startsWith('audio/') &&
      !contentType.includes('mpegurl') &&
      !contentType.includes('scpls')) ||
    contentType.startsWith('video/')

  if (!response.ok || looksLikeAudio) {
    response.body?.cancel().catch(() => {})
    return { kind: 'direct', url }
  }

  const text = (await readText(response, 64 * 1024)).trim()
  const lines = text.split(/\r?\n/)

  if (text.startsWith('#EXTM3U') && text.includes('#EXT-X-')) {
    return { kind: 'hls', url }
  }

  if (
    contentType.includes('scpls') ||
    text.toLowerCase().startsWith('[playlist]')
  ) {
    const file = /^File\d+=(.+)$/im.exec(text)?.[1]?.trim()
    if (file) return detectStream(new URL(file, finalUrl).toString(), depth + 1)
  }

  if (contentType.includes('mpegurl') || text.startsWith('#EXTM3U')) {
    const next = firstUrl(lines, finalUrl)
    if (next) return detectStream(next, depth + 1)
  }

  return { kind: 'direct', url }
}

export function resolveStream(url: string) {
  return resolvedStreams.getOrLoad(
    url,
    () => 10 * minute,
    () => detectStream(url, 0).catch(() => ({ kind: 'direct' as const, url })),
  )
}

// --- AzuraCast ----------------------------------------------------------

interface AzuraCastNowPlaying {
  station?: { name?: string; shortcode?: string }
  now_playing?: {
    song?: { title?: string; artist?: string; album?: string; art?: string }
  } | null
  live?: { is_live?: boolean }
  is_online?: boolean
}

function isNowPlayingPayload(value: unknown): value is AzuraCastNowPlaying {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const payload = value as AzuraCastNowPlaying

  return typeof payload.station?.name === 'string' && 'now_playing' in payload
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': userAgent },
    signal: timeout(8000, signal),
  })
  if (!response.ok) {
    response.body?.cancel().catch(() => {})
    return null
  }

  return response.json()
}

// --- now playing --------------------------------------------------------

export interface NowPlaying {
  available: boolean
  source: 'azuracast' | 'icy'
  // Shelv: RadioMetadataPollingPolicy, 3s for AzuraCast, 30s for ICY
  pollInterval: number
  stationName: string | null
  title: string | null
  artist: string | null
  album: string | null
  artworkUrl: string | null
  isLive: boolean
  isOnline: boolean
}

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const azuraCastResults = new TtlCache<NowPlaying>()

export function azuraCastNowPlaying(apiUrl: string): Promise<NowPlaying> {
  return azuraCastResults.getOrLoad(
    apiUrl,
    () => 2000,
    async () => {
      const unavailable: NowPlaying = {
        available: false,
        source: 'azuracast',
        pollInterval: 3000,
        stationName: null,
        title: null,
        artist: null,
        album: null,
        artworkUrl: null,
        isLive: false,
        isOnline: false,
      }

      const payload = await fetchJson(apiUrl).catch(() => null)
      if (!isNowPlayingPayload(payload)) return unavailable

      const song = payload.now_playing?.song
      const shortcode = payload.station?.shortcode
      const stationArt = shortcode
        ? `${new URL(apiUrl).origin}/api/station/${encodeURIComponent(shortcode)}/art`
        : null

      return {
        available: true,
        source: 'azuracast',
        pollInterval: 3000,
        stationName: nonEmpty(payload.station?.name),
        title: nonEmpty(song?.title),
        artist: nonEmpty(song?.artist),
        album: nonEmpty(song?.album),
        artworkUrl: nonEmpty(song?.art) ?? stationArt,
        isLive: payload.live?.is_live ?? false,
        isOnline: payload.is_online ?? true,
      }
    },
  )
}

// --- ICY ----------------------------------------------------------------
// Shelv: ICYMetadataFetcher. Opens the stream with Icy-MetaData: 1 and reads
// until the first StreamTitle, at most 2 MB or 8 seconds.

const icyResults = new TtlCache<NowPlaying>()
const icyMaxBytes = 2 * 1024 * 1024
const titleSeparators = [' - ', ' – ', ' — ', ' − ', ' ‐ ', ' ‑ ']

function normalizeDashes(value: string) {
  return value.trim().replace(/[–—−‐‑]/g, '-')
}

function decodeMetadata(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('latin1').decode(bytes)
  }
}

function parseStreamTitle(buffer: Buffer, metaint: number) {
  let offset = metaint

  while (buffer.length > offset) {
    const length = buffer[offset] * 16
    const start = offset + 1
    const end = start + length
    if (buffer.length < end) return undefined

    offset = end + metaint
    if (length === 0) continue

    const raw = decodeMetadata(buffer.subarray(start, end))
    const match =
      /StreamTitle='(.*?)';/s.exec(raw) ?? /StreamTitle='([^']*)'/.exec(raw)
    const streamTitle = match?.[1]?.trim()
    if (streamTitle) return streamTitle
  }

  return undefined
}

function splitStreamTitle(streamTitle: string) {
  for (const separator of titleSeparators) {
    const index = streamTitle.indexOf(separator)
    if (index < 0) continue

    const artist = normalizeDashes(streamTitle.slice(0, index))
    const title = normalizeDashes(streamTitle.slice(index + separator.length))
    if (!title) break

    return { artist, title }
  }

  return { artist: '', title: normalizeDashes(streamTitle) }
}

async function fetchIcy(streamUrl: string): Promise<NowPlaying> {
  const result = emptyIcyNowPlaying()

  const controller = new AbortController()
  const signal = timeout(8000, controller.signal)

  try {
    const response = await fetch(streamUrl, {
      headers: { 'icy-metadata': '1', 'user-agent': userAgent },
      signal,
    })

    result.stationName = nonEmpty(response.headers.get('icy-name'))
    const metaint = Number(response.headers.get('icy-metaint'))

    if (!response.ok || !metaint || !response.body) {
      result.available = response.ok
      return result
    }

    const reader = response.body.getReader()
    let buffer = Buffer.alloc(0)

    while (buffer.length < icyMaxBytes) {
      const { done, value } = await reader.read()
      if (done) break

      buffer = Buffer.concat([buffer, value])
      const streamTitle = parseStreamTitle(buffer, metaint)

      if (streamTitle) {
        const { artist, title } = splitStreamTitle(streamTitle)
        result.title = nonEmpty(title)
        result.artist = nonEmpty(artist)
        break
      }
    }

    return result
  } catch {
    // A timeout without a title is not an error, the station just sent none yet
    return result
  } finally {
    controller.abort()
  }
}

export function icyNowPlaying(streamUrl: string) {
  return icyResults.getOrLoad(
    streamUrl,
    () => 10000,
    () => fetchIcy(streamUrl),
  )
}

export function emptyIcyNowPlaying(): NowPlaying {
  return {
    available: true,
    source: 'icy',
    pollInterval: 30000,
    stationName: null,
    title: null,
    artist: null,
    album: null,
    artworkUrl: null,
    isLive: false,
    isOnline: true,
  }
}
