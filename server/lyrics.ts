import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyCredentials } from './auth.ts'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'
import type { LyricsService, SongMetadata } from './lyrics-service.ts'
import { createClient } from './subsonic-client.ts'

const minimumSearchLength = 2

interface SongOfNavidrome {
  song?: {
    id: string
    title?: string
    artist?: string
    album?: string
    albumId?: string
    coverArt?: string
    duration?: number
  }
}

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
      const query = (url.searchParams.get('q') ?? '').trim()
      // a search runs over every text of the database while the server waits
      const limit = Math.min(
        Math.max(Number(url.searchParams.get('limit')) || 40, 1),
        100,
      )
      const results =
        query.length >= minimumSearchLength
          ? lyricsService.searchLyrics(query, 'default', limit)
          : []
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

      const songId = url.searchParams.get('song_id')?.trim()

      if (!songId) {
        sendJson(res, 400, { error: 'song_id is required' })
        return
      }

      // The lyrics are kept for everybody under the id of the song, so what
      // belongs to that id comes from Navidrome and not from the browser
      const navidrome = createClient(config, url.searchParams)
      let song: SongMetadata
      try {
        const known = (
          await navidrome<SongOfNavidrome>('getSong', { id: songId })
        ).song
        if (!known?.title) throw new Error('no title')

        song = {
          id: songId,
          title: known.title,
          artist: known.artist || null,
          album: known.album || null,
          albumId: known.albumId || null,
          coverArt: known.coverArt || null,
          duration: known.duration ?? null,
        }
      } catch {
        sendJson(res, 404, { error: 'song not found' })
        return
      }

      const record = await lyricsService.fetchAndSave(
        song,
        'default',
        config.lyrics.includeNavidrome ? navidrome : null,
      )

      if (!record || record.source === 'none') {
        sendJson(res, 404, { error: 'not found' })
        return
      }

      sendJson(res, 200, {
        id: 0,
        trackName: record.songTitle || song.title,
        artistName: record.artistName || song.artist || '',
        plainLyrics: record.plainText,
        syncedLyrics: record.syncedLrc,
        instrumental: record.isInstrumental,
      })
      return
    }

    sendJson(res, 404, { error: 'not found' })
  }
}
