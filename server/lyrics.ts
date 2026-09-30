import type { IncomingMessage, ServerResponse } from 'node:http'
import { DiskCache } from './cache.ts'
import type { ServerConfig } from './config.ts'
import {
  abortOnClose,
  pipeUpstream,
  sendBuffer,
  sendFile,
  sendJson,
  upstreamHeaders,
} from './http.ts'
import { logger } from './logger.ts'

// Only the lookup endpoint the player uses is exposed,
// the backend is not an open proxy to the LRCLIB server
const allowedPaths = new Set(['/api/lrclib/api/get'])

export function createLyricsHandler(
  config: ServerConfig,
  cache: DiskCache | null,
) {
  const useCache = cache !== null && config.cache.lyrics

  return async function handleLyrics(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    if (!config.lyricsServer || !allowedPaths.has(url.pathname)) {
      sendJson(res, 404, { error: 'not found' })
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }

    const path = url.pathname.replace(/^\/api\/lrclib/, '')
    const target = new URL(`${config.lyricsServer}${path}${url.search}`)
    const key = DiskCache.key(`lrclib:${path}?${url.searchParams.toString()}`)

    if (useCache && cache) {
      const entry = await cache.get('lyrics', key)

      if (entry) {
        await sendFile(req, res, entry)
        return
      }
    }

    const upstream = await fetch(target, {
      headers: upstreamHeaders(req),
      signal: abortOnClose(res),
    })

    if (!useCache || !cache || upstream.status !== 200) {
      await pipeUpstream(req, res, upstream)
      return
    }

    const contentType =
      upstream.headers.get('content-type') ?? 'application/json'
    const body = Buffer.from(await upstream.arrayBuffer())

    cache.put('lyrics', key, body, contentType).catch((error) => {
      logger.warn('lyrics cache write failed', error)
    })

    sendBuffer(req, res, body, contentType)
  }
}
