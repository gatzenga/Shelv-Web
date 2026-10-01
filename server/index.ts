import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { join } from 'node:path'
import { sendArtistTopSongs } from './artist-top-songs.ts'
import { authParams, verifyAdmin, verifyCredentials } from './auth.ts'
import { DiskCache } from './cache.ts'
import { loadConfig } from './config.ts'
import { isAbortError, readBody, sendJson, sendText } from './http.ts'
import { sendInfinityMix } from './infinity-mix.ts'
import { sendInsights } from './insights.ts'
import { sendInstantMix } from './instant-mix.ts'
import { createLastFMHandler, LastFMService } from './lastfm.ts'
import { logger } from './logger.ts'
import { createLyricsHandler } from './lyrics.ts'
import { LyricsDatabase } from './lyrics-db.ts'
import { LyricsService } from './lyrics-service.ts'
import { createRadioHandler } from './radio.ts'
import { clientAddress, isHttps, mayUseSession } from './request.ts'
import { sendServerInfo, withoutLogin } from './server-info.ts'
import {
  LoginLimiter,
  parseCookies,
  SessionStore,
  sessionCookieName,
  sessionLifetime,
} from './sessions.ts'
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
    // what an earlier run left behind may be over the limit
    for (const kind of ['images', 'lyrics'] as const) {
      cache.prune(kind).catch(() => {})
    }
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

const lyricsDb = new LyricsDatabase(config.configDir)
const lyricsService = new LyricsService(config, lyricsDb)

const sessions = new SessionStore(join(config.configDir, 'sessions.json'))
await sessions.load()
const loginLimiter = new LoginLimiter()

const handleSubsonic = createSubsonicHandler(config, cache)
const handleLyrics = createLyricsHandler(config, lyricsService)
const handleRadio = createRadioHandler(config)

// Written into index.html (see static.ts), /env-config.js remains for the Vite dev server
const envConfigScript = `window.APP_CONFIG = ${JSON.stringify(config.client)};\n`
const handleStatic = createStaticHandler(config.distDir, envConfigScript)

function setSecurityHeaders(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('x-frame-options', 'SAMEORIGIN')
  res.setHeader('referrer-policy', 'same-origin')
  // the popup of the Last.fm approval has to keep its link to the app
  res.setHeader('cross-origin-opener-policy', 'same-origin-allow-popups')
  res.setHeader(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  )
  if (isHttps(req)) {
    res.setHeader('strict-transport-security', 'max-age=15552000')
  }
}

// What the server answers belongs to the user who asked, no cache in between
// may hand it to somebody else
function setPrivateCaching(res: ServerResponse) {
  res.setHeader('cache-control', 'private, no-store')
  res.setHeader('vary', 'Cookie')
}

// The paths that work without credentials: the signed links of the radio
// streams, which are checked by their signature, the return of Last.fm to the
// browser, the configuration of the app and the health check
const openPaths = new Set([
  '/api/health',
  '/api/config',
  '/api/radio/art',
  '/api/radio/hls',
  '/api/lastfm/auth/callback',
])

const loginPrefixes = [
  '/api/lyrics/',
  '/api/lrclib/',
  '/api/lastfm/',
  '/api/instant-mix',
  '/api/infinity-mix',
  '/api/insights',
  '/api/artist-top-songs',
  '/api/mix',
  '/api/server-info',
]

// Changes that concern everyone who uses the server
const adminPaths = new Set([
  '/api/lyrics/reset',
  '/api/lyrics/download-all',
  '/api/lyrics/cancel-download',
  '/api/lastfm/verify',
  '/api/lastfm/disconnect',
  '/api/lastfm/auth/begin',
  '/api/lastfm/auth/complete',
  '/api/lastfm/logs/clear',
])

function needsAdmin(pathname: string, method: string | undefined) {
  if (adminPaths.has(pathname)) return true

  // the settings of a radio station: reading is for everyone, changing is not
  return pathname === '/api/radio/settings' && method !== 'GET'
}

function needsLogin(pathname: string) {
  if (openPaths.has(pathname)) return false

  return loginPrefixes.some((prefix) => pathname.startsWith(prefix))
}

function sessionCookie(
  name: string,
  value: string,
  maxAgeMs: number,
  secure: boolean,
) {
  // Strict: the cookie is never sent along with a request from another site
  return [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

function sessionIdOf(req: IncomingMessage) {
  return parseCookies(req.headers.cookie).get(sessionCookieName(isHttps(req)))
}

async function handleLogin(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('cache-control', 'no-store')

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method not allowed' })
    return
  }

  // A form of another site can not send this type without asking first
  if (
    !req.headers['content-type']?.toLowerCase().startsWith('application/json')
  ) {
    sendJson(res, 415, { error: 'send json' })
    return
  }

  let body: unknown
  try {
    body = JSON.parse(await readBody(req, 4 * 1024))
  } catch {
    sendJson(res, 400, { error: 'invalid body' })
    return
  }

  const { u, t, s } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>
  const isText = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value.length < 256

  if (!isText(u) || !isText(t) || !isText(s)) {
    sendJson(res, 400, { error: 'invalid body' })
    return
  }

  const address = clientAddress(req)
  if (!loginLimiter.start(address, u)) {
    res.setHeader('retry-after', '600')
    sendJson(res, 429, { error: 'too many attempts, try again later' })
    return
  }

  const isValid = await verifyCredentials(
    config.navidromeUrl,
    new URLSearchParams({ u, t, s }),
  )
  if (!isValid) {
    logger.warn(
      `login of ${JSON.stringify(u.slice(0, 40))} failed (${address})`,
    )
    sendJson(res, 401, { error: 'invalid credentials' })
    return
  }

  loginLimiter.succeed(address, u)
  const id = await sessions.create({ u, t, s })
  const https = isHttps(req)
  res.setHeader(
    'set-cookie',
    sessionCookie(sessionCookieName(https), id, sessionLifetime, https),
  )
  sendJson(res, 200, { ok: true })
}

async function handleLogout(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('cache-control', 'no-store')

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method not allowed' })
    return
  }

  await sessions.delete(sessionIdOf(req))
  // both names, so nothing stays behind after a change between http and https
  res.setHeader('set-cookie', [
    sessionCookie(sessionCookieName(false), '', 0, false),
    sessionCookie(sessionCookieName(true), '', 0, true),
  ])
  sendJson(res, 200, { ok: true })
}

// Without a login the app only asks what it needs to show the login page
const publicRestPaths = /^\/rest\/(ping|getOpenSubsonicExtensions)(\.view)?$/

async function route(req: IncomingMessage, res: ServerResponse) {
  setSecurityHeaders(req, res)

  // "//host/path" would be read as an address with another host
  const target = req.url ?? '/'
  let url: URL
  try {
    if (!target.startsWith('/') || target.startsWith('//')) {
      throw new Error('not a path')
    }
    url = new URL(target, 'http://localhost')
  } catch {
    sendJson(res, 400, { error: 'bad request' })
    return
  }
  const { pathname } = url

  if (pathname.startsWith('/api/') || pathname.startsWith('/rest/')) {
    setPrivateCaching(res)
  }

  if (pathname === '/api/login') {
    await handleLogin(req, res)
    return
  }

  if (pathname === '/api/logout') {
    await handleLogout(req, res)
    return
  }

  // The only way to be logged in is the session cookie. Whatever the browser
  // put on the address is dropped, so the credentials of a user can neither be
  // tried out here nor smuggled in: the session of the user is put on instead,
  // and everything below works as if the browser had sent it
  const credentials = mayUseSession(req, pathname)
    ? sessions.get(sessionIdOf(req))
    : undefined
  for (const name of authParams) url.searchParams.delete(name)
  if (credentials) {
    url.searchParams.set('u', credentials.u)
    url.searchParams.set('t', credentials.t)
    url.searchParams.set('s', credentials.s)
  }

  // Everything but the app itself, the health check and the signed radio links
  // is only for users of the Navidrome server
  if (needsAdmin(pathname, req.method)) {
    if (!(await verifyAdmin(config.navidromeUrl, url.searchParams))) {
      sendJson(res, 403, { error: 'administrators only' })
      return
    }
  } else if (needsLogin(pathname)) {
    const isValid = await verifyCredentials(
      config.navidromeUrl,
      url.searchParams,
    )
    if (!isValid) {
      sendJson(res, 401, { error: 'invalid credentials' })
      return
    }
  } else if (
    pathname.startsWith('/rest/') &&
    !credentials &&
    !publicRestPaths.test(pathname)
  ) {
    sendJson(res, 401, {
      'subsonic-response': {
        status: 'failed',
        version: '1.16.1',
        error: { code: 40, message: 'Wrong username or password' },
      },
    })
    return
  }

  if (pathname.startsWith('/rest/')) {
    await handleSubsonic(req, res, url)
    return
  }

  if (pathname.startsWith('/api/radio/')) {
    await handleRadio(req, res, url)
    return
  }

  if (
    pathname.startsWith('/api/lrclib/') ||
    pathname.startsWith('/api/lyrics/')
  ) {
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

  if (pathname === '/api/server-info') {
    await sendServerInfo(config, res, url)
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
  logger.info(`navidrome: ${withoutLogin(config.navidromeUrl)}`)
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
