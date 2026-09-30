import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyCredentials } from './auth.ts'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'
import type { LyricsService, SongMetadata } from './lyrics-service.ts'
import { createClient } from './subsonic-client.ts'

export function createLyricsHandler(
  config: ServerConfig,
  lyricsService: LyricsService,
) {
  return async function handleLyrics(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    const { pathname } = url

    // 1. Stats endpoint
    if (pathname === '/api/lyrics/stats') {
      res.setHeader('cache-control', 'no-store')
      sendJson(res, 200, lyricsService.getStats('default'))
      return
    }

    // 2. Search endpoint
    if (pathname === '/api/lyrics/search') {
      res.setHeader('cache-control', 'no-store')
      const query = url.searchParams.get('q') ?? ''
      const limit = Number(url.searchParams.get('limit')) || 40
      const results = lyricsService.searchLyrics(query, 'default', limit)
      sendJson(res, 200, { results })
      return
    }

    // 3. Start bulk download
    if (pathname === '/api/lyrics/download-all') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }

      const isValid = await verifyCredentials(
        config.navidromeUrl,
        url.searchParams,
      )
      if (!isValid) {
        sendJson(res, 401, { error: 'invalid credentials' })
        return
      }

      const result = await lyricsService.startBulkDownload(
        url.searchParams,
        'default',
      )
      sendJson(res, 200, result)
      return
    }

    // 4. Cancel bulk download
    if (pathname === '/api/lyrics/cancel-download') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }

      lyricsService.cancelBulkDownload()
      sendJson(res, 200, { ok: true })
      return
    }

    // 5. Reset lyrics database
    if (pathname === '/api/lyrics/reset') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }

      lyricsService.resetDatabase('default')
      sendJson(res, 200, { ok: true })
      return
    }

    // 6. Player lookup endpoint (/api/lrclib/api/get)
    if (pathname === '/api/lrclib/api/get') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }

      const trackName = url.searchParams.get('track_name')?.trim()
      const artistName = url.searchParams.get('artist_name')?.trim()
      const albumName = url.searchParams.get('album_name')?.trim()
      const durationStr = url.searchParams.get('duration')?.trim()
      const songId = url.searchParams.get('song_id')?.trim()

      if (!trackName) {
        sendJson(res, 400, { error: 'track_name is required' })
        return
      }

      const song: SongMetadata = {
        id: songId || `title:${trackName}:${artistName || ''}`,
        title: trackName,
        artist: artistName || null,
        album: albumName || null,
        duration: durationStr ? Number(durationStr) : null,
      }

      let navClient = null
      if (config.lyrics.includeNavidrome && url.searchParams.has('u')) {
        navClient = createClient(config, url.searchParams)
      }

      const record = await lyricsService.fetchAndSave(
        song,
        'default',
        navClient,
      )

      if (!record || record.source === 'none') {
        sendJson(res, 404, { error: 'not found' })
        return
      }

      sendJson(res, 200, {
        id: 0,
        trackName: record.songTitle || trackName,
        artistName: record.artistName || artistName || '',
        plainLyrics: record.plainText,
        syncedLyrics: record.syncedLrc,
        instrumental: record.isInstrumental,
      })
      return
    }

    sendJson(res, 404, { error: 'not found' })
  }
}
