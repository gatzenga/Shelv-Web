import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { sendArtistTopSongs } from './artist-top-songs.ts'
import { DiskCache } from './cache.ts'
import { loadConfig } from './config.ts'
import { isAbortError, sendJson, sendText } from './http.ts'
import { sendInfinityMix } from './infinity-mix.ts'
import { sendInsights } from './insights.ts'
import { sendInstantMix } from './instant-mix.ts'
import { createLastFMHandler, LastFMService } from './lastfm.ts'
import { logger } from './logger.ts'
import { createLyricsHandler } from './lyrics.ts'
import { createRadioHandler } from './radio.ts'
import { sendSmartMix } from './smart-mix.ts'
import { createStaticHandler } from './static.ts'
import { createSubsonicHandler } from './subsonic.ts'

const config = loadConfig()

const isCacheEnabled = config.cache.images || config.cache.lyrics

let cache: DiskCache | null = null

if (isCacheEnabled) {
  try {
    await mkdir(config.cache.dir, { recursive: true })
    await access(config.cache.dir, constants.W_OK)
    cache = new DiskCache(config.cache.dir)
  } catch (error) {
    // The player keeps working without cache, e.g. when the volume is read-only
    logger.error(
      `cache folder ${config.cache.dir} is not writable, cache disabled`,
      error,
    )
  }
}

const lastfm = new LastFMService(config)
await lastfm.init()
const handleLastFM = createLastFMHandler(lastfm)
await lastfm.verifyOnLaunchIfNeeded()

const handleSubsonic = createSubsonicHandler(config, cache)
const handleLyrics = createLyricsHandler(config, cache)
const handleRadio = createRadioHandler(config)

// Written into index.html (see static.ts), /env-config.js remains for the Vite dev server
const envConfigScript = `window.APP_CONFIG = ${JSON.stringify(config.client)};\n`
const handleStatic = createStaticHandler(config.distDir, envConfigScript)

function setSecurityHeaders(res: ServerResponse) {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('x-frame-options', 'SAMEORIGIN')
  // Subsonic URLs carry auth tokens, never leak them to other sites
  res.setHeader('referrer-policy', 'same-origin')
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { pathname } = url

  setSecurityHeaders(res)

  if (pathname.startsWith('/rest/')) {
    await handleSubsonic(req, res, url)
    return
  }

  if (pathname.startsWith('/api/radio/')) {
    await handleRadio(req, res, url)
    return
  }

  if (pathname.startsWith('/api/lrclib/')) {
    await handleLyrics(req, res, url)
    return
  }

  if (pathname.startsWith('/api/lastfm/')) {
    await handleLastFM(req, res, url)
    return
  }

  if (pathname === '/api/instant-mix') {
    await sendInstantMix(config, res, url)
    return
  }

  if (pathname === '/api/infinity-mix') {
    await sendInfinityMix(config, res, url)
    return
  }

  if (pathname === '/api/insights') {
    res.setHeader('cache-control', 'no-store')
    await sendInsights(config, res, url)
    return
  }

  if (pathname === '/api/artist-top-songs') {
    await sendArtistTopSongs(config, res, url, lastfm)
    return
  }

  if (pathname === '/api/mix') {
    await sendSmartMix(config, res, url, lastfm)
    return
  }

  if (pathname === '/api/config') {
    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, config.client)
    return
  }

  if (pathname === '/api/health') {
    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, { status: 'ok' })
    return
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' })
    return
  }

  if (pathname === '/env-config.js') {
    res.setHeader('cache-control', 'no-store')
    sendText(res, 200, envConfigScript, 'text/javascript; charset=utf-8')
    return
  }

  await handleStatic(req, res, url)
}

const server = createServer((req, res) => {
  route(req, res).catch((error: unknown) => {
    if (isAbortError(error)) return

    if (error instanceof URIError) {
      if (!res.headersSent) sendJson(res, 400, { error: 'bad request' })
      return
    }

    const path = req.url?.split('?')[0]

    if (res.headersSent) {
      // The upstream broke off mid-stream, e.g. a radio station restarting.
      // Closing the connection lets the player reconnect.
      logger.warn(`${req.method} ${path} upstream ended unexpectedly`, error)
      res.destroy()
      return
    }

    logger.error(`${req.method} ${path} failed`, error)
    sendJson(res, 502, { error: 'upstream request failed' })
  })
})

server.listen(config.port, () => {
  const enabledCaches = Object.entries(config.cache)
    .filter(([name, enabled]) => name !== 'dir' && enabled === true)
    .map(([name]) => name)

  logger.info(`listening on port ${config.port}`)
  logger.info(`navidrome: ${config.navidromeUrl}`)
  logger.info(`lyrics server: ${config.lyricsServer ?? 'disabled'}`)
  logger.info(
    `cache: ${cache && enabledCaches.length > 0 ? `${enabledCaches.join(', ')} in ${config.cache.dir}` : 'disabled'}`,
  )
})

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`)
  server.close(() => process.exit(0))
  // Open audio streams would keep the server alive forever
  setTimeout(() => process.exit(0), 5000).unref()
  server.closeAllConnections()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
