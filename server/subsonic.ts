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
import { Semaphore } from './semaphore.ts'

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

  // v2: what an earlier version kept, among it placeholders, is not used any more
  return DiskCache.key(`v2|${endpoint}|${user}|${parts.join('&')}`)
}

// Navidrome gives a cover ten seconds, and makes a large one the first time it
// is asked for. Thirty at once, as a page of albums asks, make each other slow
// enough to fail. A few at a time is faster in the end.
const coverRequests = new Semaphore(6)

// What Navidrome sends for a cover it can not give right now: a picture of its
// own, marked no-store. It looks like a cover, so it has to be told by that.
function isPlaceholder(response: Response) {
  return (
    response.status === 200 &&
    (response.headers.get('content-type') ?? '').startsWith('image/') &&
    /no-store/i.test(response.headers.get('cache-control') ?? '')
  )
}

const placeholderRetryDelay = 700

// Another client gets the cover where this one gets the placeholder, so the
// placeholder is not taken for an answer: the same cover is asked for again,
// then in a larger size, then in full size. What is left is the placeholder.
async function realCover(
  first: Response,
  target: URL,
  ask: (url: URL) => Promise<Response>,
) {
  if (!isPlaceholder(first)) return first

  const fallback = new Response(await first.arrayBuffer(), first)
  const size = Number(target.searchParams.get('size')) || 0
  const variants: { label: string; url: URL; wait: number }[] = []

  const same = new URL(target)
  variants.push({ label: 'again', url: same, wait: placeholderRetryDelay })

  // Navidrome also takes the id of the album itself, without the version that
  // the id of a cover carries (al-<id>_<version>), and finds the cover from it
  const album = /^al-(.+?)(?:_[0-9a-f]+)?$/i.exec(
    target.searchParams.get('id') ?? '',
  )
  if (album) {
    const byAlbum = new URL(target)
    byAlbum.searchParams.set('id', album[1])
    variants.push({ label: 'by the id of the album', url: byAlbum, wait: 0 })
  }

  if (size > 0) {
    const larger = new URL(target)
    larger.searchParams.set('size', String(Math.min(size * 2, 1200)))
    variants.push({
      label: `size ${Math.min(size * 2, 1200)}`,
      url: larger,
      wait: 0,
    })

    const full = new URL(target)
    full.searchParams.delete('size')
    variants.push({ label: 'full size', url: full, wait: 0 })
  }

  for (const { label, url, wait } of variants) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))

    const next = await ask(url)
    if (!isPlaceholder(next)) {
      logger.info(
        `cover ${target.searchParams.get('id')}: Navidrome sent its placeholder for size ${size || 'full'}, the cover came ${label}`,
      )
      await fallback.body?.cancel()
      return next
    }
    await next.body?.cancel()
  }

  logger.warn(
    `cover ${target.searchParams.get('id')}: Navidrome only has its placeholder for it`,
  )

  return fallback
}

// no max-age: a browser keeps a picture for that long, whatever it is. Without
// it the browser asks again, which costs nothing on the same machine.
const cachedResponseMaxAge = 'private, no-cache'

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

    if (endpoint === 'getCoverArt') {
      const release = await coverRequests.acquire()

      // the browser may have gone while it waited for its turn
      if (res.destroyed) {
        release()
        return
      }
      res.once('close', release)
    }

    const signal = abortOnClose(res)
    const ask = (url: URL) =>
      fetch(url, {
        method: req.method,
        headers: upstreamHeaders(req),
        body: requestBody(req),
        signal,
        // required by Node.js to stream a request body
        duplex: 'half',
      })

    let upstream = await ask(target)
    if (endpoint === 'getCoverArt' && req.method === 'GET') {
      upstream = await realCover(upstream, target, ask)
    }

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
    // Navidrome marks the placeholder it sends for a cover it can not find
    // right now as no-store. Kept, it would stay for good.
    const isPlaceholder = /no-store/i.test(
      upstream.headers.get('cache-control') ?? '',
    )
    const isCacheable =
      kind === 'images'
        ? contentType.startsWith('image/') && !isPlaceholder
        : hasLyrics(body)

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
