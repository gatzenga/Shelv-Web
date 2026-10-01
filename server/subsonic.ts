import type { IncomingMessage, ServerResponse } from 'node:http'
import { isReversedAlbumList, sendReversedAlbumList } from './album-order.ts'
import { verifyCredentials } from './auth.ts'
import { type CacheKind, DiskCache } from './cache.ts'
import type { ServerConfig } from './config.ts'
import {
  abortOnClose,
  pipeUpstream,
  requestBody,
  sendBuffer,
  sendFile,
  upstreamHeaders,
} from './http.ts'
import { logger } from './logger.ts'

const cacheableEndpoints: Record<string, CacheKind> = {
  getCoverArt: 'images',
  getLyrics: 'lyrics',
  getLyricsBySongId: 'lyrics',
}

// What decides the answer of an endpoint. Anything else on the address means
// nothing to Navidrome, so it may not make another file on the disk either.
const cacheParams: Record<string, string[]> = {
  getCoverArt: ['id', 'size'],
  getLyrics: ['artist', 'title'],
  getLyricsBySongId: ['id'],
}

const idPattern = /^[\w.:-]{1,100}$/

function isCacheable(name: string, value: string) {
  if (name === 'id') return idPattern.test(value)
  if (name === 'size') return value === '' || /^\d{1,4}$/.test(value)

  return value.length <= 200
}

// null: this request is not cached. The cache is kept per user, because
// Navidrome decides who may see a cover (a private playlist) or a song.
function cacheKey(endpoint: string, params: URLSearchParams) {
  const user = params.get('u')?.toLowerCase()
  if (!user || !Object.hasOwn(cacheParams, endpoint)) return null

  const parts: string[] = []
  for (const name of cacheParams[endpoint]) {
    const values = params.getAll(name)
    const value = values[0] ?? ''
    if (values.length > 1 || !isCacheable(name, value)) return null

    parts.push(`${name}=${value}`)
  }

  return DiskCache.key(`${endpoint}|${user}|${parts.join('&')}`)
}

const cachedResponseMaxAge = 'private, max-age=86400'

function endpointName(pathname: string) {
  return pathname.replace(/^\/rest\//, '').replace(/\.view$/, '')
}

interface LyricsResponse {
  'subsonic-response'?: {
    status?: string
    lyrics?: { value?: string }
    lyricsList?: { structuredLyrics?: unknown[] }
  }
}

// Only successful responses that actually contain lyrics are cached,
// so lyrics added to the library later still show up
function hasLyrics(body: Buffer) {
  try {
    const response = (JSON.parse(body.toString('utf8')) as LyricsResponse)[
      'subsonic-response'
    ]
    if (response?.status !== 'ok') return false

    return Boolean(
      response.lyrics?.value || response.lyricsList?.structuredLyrics?.length,
    )
  } catch {
    return false
  }
}

export function createSubsonicHandler(
  config: ServerConfig,
  cache: DiskCache | null,
) {
  const enabledKinds: Record<CacheKind, boolean> = config.cache

  function cacheKindFor(req: IncomingMessage, url: URL): CacheKind | null {
    if (!cache) return null
    if (req.method !== 'GET' && req.method !== 'HEAD') return null

    const endpoint = endpointName(url.pathname)
    const kind = Object.hasOwn(cacheableEndpoints, endpoint)
      ? cacheableEndpoints[endpoint]
      : undefined
    if (!kind || !enabledKinds[kind]) return null

    return kind
  }

  return async function handleSubsonic(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    const target = new URL(`${config.navidromeUrl}${url.pathname}${url.search}`)
    const endpoint = endpointName(url.pathname)

    if (isReversedAlbumList(endpoint, url.searchParams)) {
      await sendReversedAlbumList(config, res, url.searchParams)
      return
    }
    const key = cacheKey(endpoint, url.searchParams)
    const kind = key ? cacheKindFor(req, url) : null

    if (cache && kind && key) {
      const entry = await cache.get(kind, key)

      if (
        entry &&
        (await verifyCredentials(config.navidromeUrl, url.searchParams))
      ) {
        await sendFile(req, res, {
          ...entry,
          cacheControl: cachedResponseMaxAge,
        })
        return
      }
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers: upstreamHeaders(req),
      body: requestBody(req),
      signal: abortOnClose(res),
      // required by Node.js to stream a request body
      duplex: 'half',
    })

    if (!cache || !kind || !key) {
      await pipeUpstream(req, res, upstream)
      return
    }

    const contentType = upstream.headers.get('content-type') ?? ''

    // Images and lyrics are small, so they are buffered and stored right away
    if (upstream.status !== 200 || req.method === 'HEAD') {
      await pipeUpstream(req, res, upstream)
      return
    }

    const body = Buffer.from(await upstream.arrayBuffer())
    const isCacheable =
      kind === 'images' ? contentType.startsWith('image/') : hasLyrics(body)

    if (isCacheable) {
      cache.put(kind, key, body, contentType).catch((error) => {
        logger.warn(`${kind} cache write failed`, error)
      })
    }

    const cacheControl =
      upstream.headers.get('cache-control') ??
      (isCacheable ? cachedResponseMaxAge : 'no-cache')
    res.setHeader('cache-control', cacheControl)
    sendBuffer(req, res, body, contentType)
  }
}
