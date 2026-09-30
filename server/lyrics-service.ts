import type { ServerConfig } from './config.ts'
import { logger } from './logger.ts'
import { LyricsDatabase, type LyricsRecord } from './lyrics-db.ts'
import { createClient, type SubsonicRequest } from './subsonic-client.ts'

export interface SongMetadata {
  id: string
  title: string
  artist?: string | null
  album?: string | null
  albumId?: string | null
  duration?: number | null
  coverArt?: string | null
}

interface LrcLibResponse {
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

const SIX_MONTHS_SEC = 60 * 60 * 24 * 180

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class LyricsService {
  private config: ServerConfig
  private db: LyricsDatabase
  private isDownloading = false
  private downloadFetched = 0
  private downloadTotal = 0
  private cancelDownloadRequested = false

  constructor(config: ServerConfig, db: LyricsDatabase) {
    this.config = config
    this.db = db
  }

  getStats(serverId = 'default') {
    const fetched = this.db.fetchedCount(serverId)
    const size = this.db.diskSizeBytes()
    return {
      count: fetched,
      sizeBytes: size,
      isDownloading: this.isDownloading,
      downloadFetched: this.downloadFetched,
      downloadTotal: this.downloadTotal,
    }
  }

  resetDatabase(serverId = 'default') {
    this.cancelBulkDownload()
    this.db.reset(serverId)
    this.downloadFetched = 0
    this.downloadTotal = 0
  }

  searchLyrics(query: string, serverId = 'default', limit = 40) {
    return this.db.searchLyrics(query, serverId, limit)
  }

  async fetchAndSave(
    song: SongMetadata,
    serverId = 'default',
    navidromeReq?: SubsonicRequest | null,
  ): Promise<LyricsRecord | null> {
    const nowSec = Date.now() / 1000

    // 1. Check local SQLite cache (< 6 months, source != 'none')
    const cached = this.db.getLyrics(song.id, serverId)
    if (
      cached &&
      cached.source !== 'none' &&
      nowSec - cached.fetchedAt < SIX_MONTHS_SEC
    ) {
      // Backfill metadata if missing
      if (
        !cached.songTitle ||
        !cached.artistName ||
        !cached.coverArt ||
        cached.songDuration === null
      ) {
        this.db.updateMetadata(
          song.id,
          serverId,
          song.title,
          song.artist,
          song.albumId,
          song.coverArt,
          song.duration,
        )
      }
      return cached
    }

    // 2. Navidrome check (if enabled and client available)
    if (this.config.lyrics.includeNavidrome && navidromeReq) {
      try {
        const navLyrics = await this.fetchFromNavidrome(
          song,
          serverId,
          navidromeReq,
        )
        if (navLyrics) {
          this.db.saveLyrics(navLyrics)
          return navLyrics
        }
      } catch (err) {
        logger.warn(
          `[LyricsService] Navidrome fetch failed for ${song.title}`,
          err,
        )
      }
    }

    // 3. LRCLIB check
    const lrcRecord = await this.fetchFromLrcLib(song, serverId)
    if (lrcRecord) {
      this.db.saveLyrics(lrcRecord)
      return lrcRecord
    }

    return null
  }

  private async fetchFromNavidrome(
    song: SongMetadata,
    serverId: string,
    req: SubsonicRequest,
  ): Promise<LyricsRecord | null> {
    try {
      const resp = await req<{
        lyricsList?: {
          structuredLyrics?: Array<{
            lang?: string
            synced?: boolean
            line?: Array<{ start?: number; value: string }>
          }>
        }
      }>('getLyricsBySongId', { id: song.id })

      const structured = resp?.lyricsList?.structuredLyrics ?? []
      if (structured.length > 0) {
        // prefer synced if available
        const entry = structured.find((item) => item.synced) ?? structured[0]
        const lines = entry.line ?? []
        if (lines.length > 0) {
          const plain = lines.map((l) => l.value).join('\n')
          let syncedLrc: string | null = null
          if (entry.synced) {
            const formattedLines = lines
              .filter((l) => l.start !== undefined)
              .map((l) => {
                const ms = l.start ?? 0
                const min = Math.floor(ms / 60000)
                const sec = Math.floor((ms % 60000) / 1000)
                const cs = Math.floor((ms % 1000) / 10)
                const minStr = String(min).padStart(2, '0')
                const secStr = String(sec).padStart(2, '0')
                const csStr = String(cs).padStart(2, '0')
                return `[${minStr}:${secStr}.${csStr}] ${l.value}`
              })
            if (formattedLines.length > 0) {
              syncedLrc = formattedLines.join('\n')
            }
          }

          return {
            songId: song.id,
            serverId,
            source: 'navidrome',
            plainText: plain,
            syncedLrc,
            isSynced: Boolean(entry.synced && syncedLrc),
            isInstrumental: false,
            language: entry.lang ?? null,
            fetchedAt: Date.now() / 1000,
            songTitle: song.title,
            artistName: song.artist,
            albumId: song.albumId,
            coverArt: song.coverArt,
            songDuration: song.duration,
          }
        }
      }
    } catch {
      // not supported or no match
    }

    return null
  }

  private async fetchFromLrcLib(
    song: SongMetadata,
    serverId: string,
  ): Promise<LyricsRecord | null> {
    const params = new URLSearchParams({
      track_name: song.title,
    })
    if (song.artist) params.set('artist_name', song.artist)
    if (song.album) params.set('album_name', song.album)
    if (song.duration) params.set('duration', String(Math.round(song.duration)))

    const { customServer, fallback, defaultServer } = this.config.lyrics
    const queryString = params.toString()

    // The order of the Shelv app: your own server first, then the public
    // LRCLIB when the fallback is on. A source that is not set up is skipped.
    const servers = [
      ...(customServer ? [customServer] : []),
      ...(fallback ? [defaultServer] : []),
    ]

    let allNotFound = servers.length > 0

    for (const server of servers) {
      const outcome = await this.queryLrcLibEndpoint(
        `${server}/api/get?${queryString}`,
        song,
        serverId,
      )
      if (outcome.status === 'found') return outcome.record
      if (outcome.status !== 'not_found') allNotFound = false
    }

    // Every source answered that it has nothing: remember it
    if (allNotFound) {
      const noneRecord = this.makeEmptyRecord(song, serverId)
      this.db.saveLyrics(noneRecord)
      return noneRecord
    }

    return null
  }

  private async queryLrcLibEndpoint(
    url: string,
    song: SongMetadata,
    serverId: string,
  ): Promise<
    | { status: 'found'; record: LyricsRecord }
    | { status: 'not_found' }
    | { status: 'indeterminate' }
  > {
    const backoffsMs = [0, 400, 1500]

    for (let attempt = 0; attempt < backoffsMs.length; attempt++) {
      const delay = backoffsMs[attempt]
      if (delay > 0) {
        const jitter = Math.floor(Math.random() * 250)
        await sleep(delay + jitter)
      }

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Shelv/1.0 (https://github.com/gatzenga/Shelv)',
            'Lrclib-Client': 'Shelv Web',
          },
          signal: AbortSignal.timeout(8000),
        })

        if (response.status === 404) {
          return { status: 'not_found' }
        }

        if (response.status === 200) {
          const data = (await response.json()) as LrcLibResponse
          if (data.instrumental) {
            return {
              status: 'found',
              record: {
                songId: song.id,
                serverId,
                source: 'lrclib',
                plainText: null,
                syncedLrc: null,
                isSynced: false,
                isInstrumental: true,
                language: null,
                fetchedAt: Date.now() / 1000,
                songTitle: song.title,
                artistName: song.artist,
                albumId: song.albumId,
                coverArt: song.coverArt,
                songDuration: song.duration,
              },
            }
          }

          if (data.plainLyrics || data.syncedLyrics) {
            return {
              status: 'found',
              record: {
                songId: song.id,
                serverId,
                source: 'lrclib',
                plainText: data.plainLyrics
                  ? data.plainLyrics.trim().replaceAll('\r\n', '\n')
                  : null,
                syncedLrc: data.syncedLyrics
                  ? data.syncedLyrics.trim().replaceAll('\r\n', '\n')
                  : null,
                isSynced: Boolean(data.syncedLyrics),
                isInstrumental: false,
                language: null,
                fetchedAt: Date.now() / 1000,
                songTitle: song.title,
                artistName: song.artist,
                albumId: song.albumId,
                coverArt: song.coverArt,
                songDuration: song.duration,
              },
            }
          }

          return { status: 'not_found' }
        }

        if (response.status >= 500 || response.status === 429) {
          continue
        }
      } catch (err) {
        logger.warn(`[LyricsService] HTTP request error for ${song.title}`, err)
      }
    }

    return { status: 'indeterminate' }
  }

  private makeEmptyRecord(song: SongMetadata, serverId: string): LyricsRecord {
    return {
      songId: song.id,
      serverId,
      source: 'none',
      plainText: null,
      syncedLrc: null,
      isSynced: false,
      isInstrumental: false,
      language: null,
      fetchedAt: Date.now() / 1000,
      songTitle: song.title,
      artistName: song.artist,
      albumId: song.albumId,
      coverArt: song.coverArt,
      songDuration: song.duration,
    }
  }

  // MARK: - Bulk Download

  async startBulkDownload(
    authParams: URLSearchParams,
    serverId = 'default',
  ): Promise<{ started: boolean; message?: string }> {
    if (this.isDownloading) {
      return { started: false, message: 'download already in progress' }
    }

    this.isDownloading = true
    this.cancelDownloadRequested = false
    this.downloadFetched = 0
    this.downloadTotal = 0

    // Run in background without blocking response
    queueMicrotask(() => {
      this.runBulkDownloadTask(authParams, serverId)
        .catch((error) => {
          logger.error('[LyricsService] Bulk download crashed', error)
        })
        .finally(() => {
          this.isDownloading = false
        })
    })

    return { started: true }
  }

  cancelBulkDownload() {
    if (this.isDownloading) {
      this.cancelDownloadRequested = true
    }
  }

  private async runBulkDownloadTask(
    authParams: URLSearchParams,
    serverId: string,
  ) {
    const client = createClient(this.config, authParams)

    logger.info('[LyricsService] Starting bulk lyrics download...')

    // 1. Fetch all albums
    const albums: Array<{ id: string }> = []
    let offset = 0
    const pageSize = 500

    while (!this.cancelDownloadRequested) {
      try {
        const resp = await client<{
          albumList2?: { album?: Array<{ id: string }> }
        }>('getAlbumList2', {
          type: 'alphabeticalByName',
          size: String(pageSize),
          offset: String(offset),
        })

        const list = resp?.albumList2?.album ?? []
        albums.push(...list)
        if (list.length < pageSize) break
        offset += pageSize
      } catch (err) {
        logger.error('[LyricsService] Failed to fetch album list', err)
        break
      }
    }

    if (this.cancelDownloadRequested || albums.length === 0) {
      this.isDownloading = false
      return
    }

    // 2. Fetch songs for all albums
    const allSongs: SongMetadata[] = []
    const albumConcurrency = 8

    for (
      let i = 0;
      i < albums.length && !this.cancelDownloadRequested;
      i += albumConcurrency
    ) {
      const slice = albums.slice(i, i + albumConcurrency)
      const results = await Promise.allSettled(
        slice.map(async (album) => {
          const detail = await client<{
            album?: {
              song?: Array<{
                id: string
                title: string
                artist?: string
                album?: string
                albumId?: string
                duration?: number
                coverArt?: string
              }>
            }
          }>('getAlbum', { id: album.id })

          return detail?.album?.song ?? []
        }),
      )

      for (const res of results) {
        if (res.status === 'fulfilled') {
          for (const s of res.value) {
            allSongs.push({
              id: s.id,
              title: s.title,
              artist: s.artist,
              album: s.album,
              albumId: s.albumId,
              duration: s.duration,
              coverArt: s.coverArt,
            })
          }
        }
      }
    }

    if (this.cancelDownloadRequested) {
      this.isDownloading = false
      return
    }

    // 3. Filter out songs already in DB
    const cachedIds = this.db.cachedSongIds(serverId)
    const songsToDownload = allSongs.filter((s) => !cachedIds.has(s.id))

    this.downloadTotal = songsToDownload.length
    this.downloadFetched = 0

    logger.info(
      `[LyricsService] Found ${allSongs.length} total songs, ${songsToDownload.length} to download`,
    )

    // 4. Download lyrics with controlled concurrency (4 concurrent requests)
    const concurrency = 4
    let currentIndex = 0

    const worker = async () => {
      while (
        currentIndex < songsToDownload.length &&
        !this.cancelDownloadRequested
      ) {
        const index = currentIndex++
        const song = songsToDownload[index]
        if (!song) break

        try {
          await this.fetchAndSave(song, serverId, client)
        } catch (err) {
          logger.warn(
            `[LyricsService] Error downloading lyrics for ${song.title}`,
            err,
          )
        }

        this.downloadFetched++
        // Gentle delay to avoid hammering upstream services
        await sleep(60)
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)

    logger.info(
      `[LyricsService] Bulk download complete. Downloaded: ${this.downloadFetched}/${this.downloadTotal}`,
    )
  }
}
