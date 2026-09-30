import type { IncomingMessage, ServerResponse } from 'node:http'
import { isReversedAlbumList, sendReversedAlbumList } from './album-order.ts'
import { authParams, verifyCredentials } from './auth.ts'
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

// Params that do not change the response and therefore are not part of cache keys
const volatileParams = new Set([...authParams, 'c', 'v'])

const cacheableEndpoints: Record<string, CacheKind> = {
  getCoverArt: 'images',
  getLyrics: 'lyrics',
  getLyricsBySongId: 'lyrics',
}

const cachedResponseMaxAge = 'private, max-age=86400'

function endpointName(pathname: string) {
  return pathname.replace(/^\/rest\//, '').replace(/\.view$/, '')
}

function cacheKey(endpoint: string, params: URLSearchParams) {
  const relevant = [...params.entries()]
    .filter(([name]) => !volatileParams.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)

  return DiskCache.key(`${endpoint}?${relevant.join('&')}`)
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

    const kind = cacheableEndpoints[endpointName(url.pathname)]
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
    const kind = cacheKindFor(req, url)
    const key = kind ? cacheKey(endpoint, url.searchParams) : null

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
