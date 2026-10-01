import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname } from 'node:path'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'
import { LastFMClient } from './lastfm-client.ts'
import { lastfmLog } from './lastfm-log.ts'
import {
  bestMatch,
  type LibrarySong,
  searchQueries,
  trackKey,
} from './lastfm-matcher.ts'
import {
  LastFMAPIError,
  type LastFMConnectionProblem,
  type LastFMConnectionState,
  type LastFMTrack,
} from './lastfm-types.ts'
import { logger } from './logger.ts'
import type { SubsonicRequest } from './subsonic-client.ts'

interface StoredSession {
  sessionKey: string
  username: string
  isEnabled?: boolean
}

interface CachedMatch {
  song: LibrarySong | null
  storedAt: number
}

export function problemDescription(problem: LastFMConnectionProblem): string {
  if (typeof problem === 'string') {
    switch (problem) {
      case 'invalidAPIKey':
        return 'Ungültiger API-Key'
      case 'invalidSecret':
        return 'Ungültiges Shared Secret'
      case 'accessRevoked':
        return 'Zugriff in Last.fm widerrufen'
      case 'authorizationIncomplete':
        return 'Freigabe im Browser nicht abgeschlossen'
      case 'unreachable':
        return 'Last.fm nicht erreichbar'
    }
  }
  return problem.other
}

function problemForError(error: unknown): LastFMConnectionProblem {
  if (error instanceof LastFMAPIError) {
    switch (error.code) {
      case LastFMAPIError.invalidAPIKey:
      case LastFMAPIError.suspendedAPIKey:
        return 'invalidAPIKey'
      case LastFMAPIError.invalidSignature:
      case LastFMAPIError.authenticationFailed:
        return 'invalidSecret'
      case LastFMAPIError.invalidSessionKey:
        return 'accessRevoked'
      case LastFMAPIError.unauthorizedToken:
        return 'authorizationIncomplete'
      default:
        return { other: error.message }
    }
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'unreachable'
  }
  return { other: error instanceof Error ? error.message : String(error) }
}

export class LastFMService {
  private config: ServerConfig
  private client: LastFMClient | null = null
  private sessionFile: string
  private session: StoredSession | null = null
  private didVerifyOnLaunch = false

  private state: LastFMConnectionState = 'notConfigured'
  private username: string | null = null
  private problem: LastFMConnectionProblem | null = null
  private lastChecked: string | null = null

  private matchCache = new Map<string, CachedMatch>()
  private artistTracksCache = new Map<
    string,
    { tracks: LastFMTrack[]; storedAt: number }
  >()
  private matchCacheLifetime = 30 * 60 * 1000 // 30 minutes
  private minimumMixSize = 10

  constructor(config: ServerConfig) {
    this.config = config
    this.sessionFile = config.lastfm.sessionFile
    lastfmLog.setLogsDir(config.logsDir)

    if (config.lastfm.apiKey && config.lastfm.sharedSecret) {
      this.client = new LastFMClient(
        config.lastfm.apiKey,
        config.lastfm.sharedSecret,
      )
      this.state = 'notConnected'
    } else {
      this.state = 'notConfigured'
    }
  }

  async init(): Promise<void> {
    try {
      await mkdir(dirname(this.sessionFile), { recursive: true })
    } catch (error) {
      logger.error(`Failed to create ${dirname(this.sessionFile)}`, error)
    }
    await lastfmLog.load()
    await lastfmLog.init()
    await this.loadSession()
  }

  private async loadSession(): Promise<void> {
    try {
      const data = await readFile(this.sessionFile, 'utf-8')
      const parsed = JSON.parse(data) as StoredSession
      if (parsed.sessionKey && parsed.username) {
        this.session = parsed
        if (this.client) {
          this.state = 'connected'
          this.username = parsed.username
        }
      }
    } catch {
      this.session = null
    }
  }

  private async saveSession(session: StoredSession | null): Promise<void> {
    this.session = session
    try {
      await mkdir(dirname(this.sessionFile), { recursive: true })
      if (session) {
        await writeFile(
          this.sessionFile,
          JSON.stringify(session, null, 2),
          'utf-8',
        )
      } else {
        await unlink(this.sessionFile).catch(() => {})
      }
    } catch (error) {
      logger.error(`Failed to save session to ${this.sessionFile}`, error)
      lastfmLog.failure(
        `Could not save session: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  getStatus() {
    return {
      isConfigured: Boolean(this.client),
      state: this.state,
      username: this.username,
      problem: this.problem,
      lastChecked: this.lastChecked,
    }
  }

  async verifyOnLaunchIfNeeded(): Promise<void> {
    if (this.didVerifyOnLaunch) return
    this.didVerifyOnLaunch = true
    if (this.client && this.session?.sessionKey) {
      await this.verifyConnection()
    }
  }

  async verifyConnection() {
    if (!this.client) {
      this.state = 'notConfigured'
      this.username = null
      this.problem = null
      return this.getStatus()
    }
    if (!this.session?.sessionKey) {
      this.state = 'notConnected'
      this.username = null
      this.problem = null
      return this.getStatus()
    }

    this.state = 'checking'
    try {
      const username = await this.client.authenticatedUsername(
        this.session.sessionKey,
      )
      if (username !== this.session.username) {
        this.session.username = username
        await this.saveSession(this.session)
      }
      lastfmLog.success(`Connection OK, signed in as ${username}`)
      this.state = 'connected'
      this.username = username
      this.problem = null
      this.lastChecked = new Date().toISOString()
    } catch (error) {
      const problem = problemForError(error)
      lastfmLog.failure(
        `Connection check failed: ${problemDescription(problem)}`,
      )
      this.state = 'failed'
      this.problem = problem
      this.lastChecked = new Date().toISOString()
    }
    return this.getStatus()
  }

  async disconnect() {
    await this.saveSession(null)
    this.matchCache.clear()
    lastfmLog.info('Disconnected from Last.fm')
    this.state = this.client ? 'notConnected' : 'notConfigured'
    this.username = null
    this.problem = null
    this.lastChecked = null
    return this.getStatus()
  }

  async beginAuthorization(callbackUrl: string) {
    if (!this.client) {
      throw new Error('Last.fm is not configured')
    }
    try {
      const token = await this.client.requestToken()
      const authUrl = LastFMClient.authorizationURL(
        this.client.apiKey,
        token,
        callbackUrl,
      )
      lastfmLog.success('Approval page opened')
      return { token, authUrl }
    } catch (error) {
      const problem = problemForError(error)
      lastfmLog.failure(
        `Could not start approval: ${problemDescription(problem)}`,
      )
      this.state = 'failed'
      this.problem = problem
      throw error
    }
  }

  async completeAuthorization(token: string): Promise<boolean> {
    if (!this.client) return false
    try {
      const session = await this.client.requestSession(token)
      await this.saveSession({
        sessionKey: session.sessionKey,
        username: session.username,
        isEnabled: true,
      })
      this.matchCache.clear()
      lastfmLog.success(`Connected as ${session.username}`)
      this.state = 'connected'
      this.username = session.username
      this.problem = null
      this.lastChecked = new Date().toISOString()
      return true
    } catch (error) {
      if (
        error instanceof LastFMAPIError &&
        error.code === LastFMAPIError.unauthorizedToken
      ) {
        return false
      }
      const problem = problemForError(error)
      lastfmLog.failure(`Approval failed: ${problemDescription(problem)}`)
      this.state = 'failed'
      this.problem = problem
      this.lastChecked = new Date().toISOString()
      return false
    }
  }

  // Last.fm's most popular tracks of an artist, as Last.fm names them.
  // null means Last.fm is not configured or could not answer and the caller
  // should use the play counts of the server.
  async artistTopTracks(artistName: string): Promise<LastFMTrack[] | null> {
    if (!this.client) return null

    const key = artistName.toLowerCase()
    const cached = this.artistTracksCache.get(key)
    if (cached && Date.now() - cached.storedAt < this.matchCacheLifetime) {
      return cached.tracks
    }

    try {
      const tracks = await this.client.artistTopTracks(artistName)
      this.artistTracksCache.set(key, { tracks, storedAt: Date.now() })
      return tracks
    } catch (error) {
      const problem = problemForError(error)
      lastfmLog.failure(
        `Top Songs: Last.fm request for ${artistName} failed (${problemDescription(problem)}), using play counts`,
      )
      return null
    }
  }

  async topSongs(
    request: SubsonicRequest,
    limit = 50,
  ): Promise<LibrarySong[] | null> {
    return this.songs(
      'Frequently Played',
      `top tracks of the period ${this.config.lastfm.period}`,
      limit,
      3,
      request,
      (client, session, page) =>
        client.topTracks(
          session.username,
          session.sessionKey,
          page,
          this.config.lastfm.period,
        ),
    )
  }

  async recentSongs(
    request: SubsonicRequest,
    limit = 50,
  ): Promise<LibrarySong[] | null> {
    return this.songs(
      'Recently Played',
      'recent tracks',
      limit,
      5,
      request,
      (client, session, page) =>
        client.recentTracks(session.username, session.sessionKey, page),
    )
  }

  private async songs(
    label: string,
    source: string,
    limit: number,
    maxPages: number,
    request: SubsonicRequest,
    fetchPage: (
      client: LastFMClient,
      session: StoredSession,
      page: number,
    ) => Promise<{ tracks: LastFMTrack[]; totalPages: number }>,
  ): Promise<LibrarySong[] | null> {
    if (!this.client || !this.session?.sessionKey || !this.session?.username) {
      lastfmLog.info(`${label}: Last.fm not connected, using Navidrome`)
      return null
    }

    lastfmLog.info(`${label}: requesting ${source} from Last.fm`)
    const result: LibrarySong[] = []
    const seenTracks = new Set<string>()
    const seenSongs = new Set<string>()
    let checked = 0
    let page = 1
    let totalPages = 1

    do {
      let fetched: { tracks: LastFMTrack[]; totalPages: number }
      try {
        fetched = await fetchPage(this.client, this.session, page)
      } catch (error) {
        const problem = problemForError(error)
        lastfmLog.failure(
          `${label}: request failed (${problemDescription(problem)})`,
        )
        return this.finish(label, result, checked)
      }

      totalPages = fetched.totalPages
      const fresh = fetched.tracks.filter((track) => {
        const key = trackKey(track)
        if (seenTracks.has(key)) return false
        seenTracks.add(key)
        return true
      })

      checked += fresh.length
      const resolved = await this.resolve(fresh, request)

      for (const song of resolved) {
        if (!seenSongs.has(song.id)) {
          seenSongs.add(song.id)
          result.push(song)
          if (result.length >= limit) break
        }
      }

      page += 1
    } while (result.length < limit && page <= Math.min(totalPages, maxPages))

    return this.finish(label, result, checked)
  }

  private finish(
    label: string,
    songs: LibrarySong[],
    checked: Int = songs.length,
  ): LibrarySong[] | null {
    if (songs.length < this.minimumMixSize) {
      lastfmLog.failure(
        `${label}: only ${songs.length} of ${checked} tracks are in your library, using Navidrome`,
      )
      return null
    }
    lastfmLog.success(
      `${label}: ${songs.length} songs ready (${checked} Last.fm tracks checked)`,
    )
    return songs
  }

  private async resolve(
    tracks: LastFMTrack[],
    request: SubsonicRequest,
  ): Promise<LibrarySong[]> {
    const resolved: (LibrarySong | null)[] = new Array(tracks.length).fill(null)
    const pending: { index: number; track: LastFMTrack }[] = []
    const now = Date.now()

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      const key = trackKey(track)
      const cached = this.matchCache.get(key)
      if (cached && now - cached.storedAt < this.matchCacheLifetime) {
        resolved[i] = cached.song
      } else {
        pending.push({ index: i, track })
      }
    }

    if (pending.length > 0) {
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < pending.length) {
          const item = pending[nextIndex++]
          if (!item) break
          const song = await this.findSong(item.track, request)
          resolved[item.index] = song
          const key = trackKey(item.track)
          this.matchCache.set(key, { song, storedAt: now })
        }
      }
      const concurrency = Math.min(6, pending.length)
      await Promise.all(Array.from({ length: concurrency }, worker))
    }

    return resolved.filter((s): s is LibrarySong => s !== null)
  }

  private async findSong(
    track: LastFMTrack,
    request: SubsonicRequest,
  ): Promise<LibrarySong | null> {
    const queries = searchQueries(track)
    for (const query of queries) {
      try {
        const response = await request<{
          searchResult3?: { song?: LibrarySong[] }
        }>('search3', {
          query,
          songCount: '20',
          artistCount: '0',
          albumCount: '0',
        })
        const candidates = response.searchResult3?.song ?? []
        const match = bestMatch(track, candidates)
        if (match) {
          return match
        }
      } catch {
        // Try next query
      }
    }
    return null
  }
}

type Int = number

export function createLastFMHandler(service: LastFMService) {
  return async function handleLastFM(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ): Promise<void> {
    const { pathname } = url

    if (pathname === '/api/lastfm/status' && req.method === 'GET') {
      res.setHeader('cache-control', 'no-store')
      sendJson(res, 200, service.getStatus())
      return
    }

    if (pathname === '/api/lastfm/verify' && req.method === 'POST') {
      res.setHeader('cache-control', 'no-store')
      const status = await service.verifyConnection()
      sendJson(res, 200, status)
      return
    }

    if (pathname === '/api/lastfm/disconnect' && req.method === 'POST') {
      res.setHeader('cache-control', 'no-store')
      const status = await service.disconnect()
      sendJson(res, 200, status)
      return
    }

    if (pathname === '/api/lastfm/auth/begin' && req.method === 'GET') {
      const callbackParam = url.searchParams.get('callback')
      const proto = req.headers['x-forwarded-proto'] || 'http'
      const host =
        req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
      const callbackUrl =
        callbackParam || `${proto}://${host}/api/lastfm/auth/callback`
      try {
        const result = await service.beginAuthorization(callbackUrl)
        res.setHeader('cache-control', 'no-store')
        sendJson(res, 200, result)
      } catch {
        sendJson(res, 502, { error: 'failed to begin authorization' })
      }
      return
    }

    if (pathname === '/api/lastfm/auth/complete' && req.method === 'POST') {
      const token = url.searchParams.get('token')
      if (!token) {
        sendJson(res, 400, { error: 'token parameter is required' })
        return
      }
      const success = await service.completeAuthorization(token)
      res.setHeader('cache-control', 'no-store')
      sendJson(res, 200, {
        success,
        ...service.getStatus(),
      })
      return
    }

    if (pathname === '/api/lastfm/auth/callback' && req.method === 'GET') {
      const token = url.searchParams.get('token')
      let success = false
      if (token) {
        success = await service.completeAuthorization(token)
      }

      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Last.fm Authorization</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #0f1115;
      color: #f1f5f9;
      text-align: center;
    }
    .card {
      background: #181b21;
      padding: 36px 40px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.08);
      max-width: 420px;
      margin: 20px;
    }
    .icon {
      font-size: 44px;
      margin-bottom: 16px;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: 600;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .btn {
      background: #334155;
      color: #f8fafc;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn:hover {
      background: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    ${
      success
        ? `
      <div class="icon" style="color: #4ade80;">✓</div>
      <h2>Erfolgreich verbunden</h2>
      <p>Last.fm wurde autorisiert. Dieses Fenster schließt sich automatisch.</p>
    `
        : `
      <div class="icon" style="color: #f87171;">✗</div>
      <h2>Verbindung fehlgeschlagen</h2>
      <p>Die Freigabe konnte nicht abgeschlossen werden. Du kannst das Fenster schließen und es erneut versuchen.</p>
    `
    }
    <button class="btn" onclick="window.close()">Fenster schließen</button>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'lastfm-auth-result', success: ${success} }, '*');
    }
    ${
      success
        ? `setTimeout(function() {
      window.close();
    }, 1200);`
        : ''
    }
  </script>
</body>
</html>`)
      return
    }

    if (pathname === '/api/lastfm/logs' && req.method === 'GET') {
      res.setHeader('cache-control', 'no-store')
      sendJson(res, 200, { entries: lastfmLog.entries })
      return
    }

    if (pathname === '/api/lastfm/logs/clear' && req.method === 'POST') {
      await lastfmLog.clear()
      res.setHeader('cache-control', 'no-store')
      sendJson(res, 200, { ok: true, entries: [] })
      return
    }

    sendJson(res, 404, { error: 'not found' })
  }
}
