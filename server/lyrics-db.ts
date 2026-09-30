import { statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { logger } from './logger.ts'

export interface LyricsRecord {
  songId: string
  serverId: string
  source: 'navidrome' | 'lrclib' | 'none'
  plainText: string | null
  syncedLrc: string | null
  isSynced: boolean
  isInstrumental: boolean
  language: string | null
  fetchedAt: number // epoch seconds
  songTitle?: string | null
  artistName?: string | null
  albumId?: string | null
  coverArt?: string | null
  songDuration?: number | null
}

export interface LyricsSearchResult {
  id: string
  songId: string
  songTitle: string | null
  artistName: string | null
  albumId: string | null
  coverArt: string | null
  snippet: string
  duration: number | null
}

export class LyricsDatabase {
  private db: DatabaseSync | null = null
  private dbPath: string

  constructor(configDir: string) {
    this.dbPath = join(configDir, 'lyrics.db')
    this.init()
  }

  private init() {
    try {
      this.db = new DatabaseSync(this.dbPath)
      this.db.exec('PRAGMA journal_mode = WAL;')
      this.db.exec('PRAGMA synchronous = NORMAL;')

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS lyrics (
          songId TEXT NOT NULL,
          serverId TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'none',
          plainText TEXT,
          syncedLrc TEXT,
          isSynced INTEGER NOT NULL DEFAULT 0,
          isInstrumental INTEGER NOT NULL DEFAULT 0,
          language TEXT,
          fetchedAt REAL NOT NULL,
          songTitle TEXT,
          artistName TEXT,
          albumId TEXT,
          coverArt TEXT,
          songDuration INTEGER,
          PRIMARY KEY (songId, serverId)
        );
        CREATE INDEX IF NOT EXISTS idx_lyrics_search ON lyrics(serverId, source, isInstrumental);
        CREATE INDEX IF NOT EXISTS idx_lyrics_song ON lyrics(songId, serverId);
      `)
      logger.info(`lyrics database initialized at ${this.dbPath}`)
    } catch (error) {
      logger.error('failed to initialize lyrics database', error)
      this.db = null
    }
  }

  getLyrics(songId: string, serverId: string): LyricsRecord | null {
    if (!this.db) return null
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM lyrics WHERE songId = ? AND serverId = ?',
      )
      const row = stmt.get(songId, serverId) as
        | Record<string, unknown>
        | undefined
      if (!row) return null

      return {
        songId: String(row.songId),
        serverId: String(row.serverId),
        source: row.source as 'navidrome' | 'lrclib' | 'none',
        plainText: row.plainText ? String(row.plainText) : null,
        syncedLrc: row.syncedLrc ? String(row.syncedLrc) : null,
        isSynced: Number(row.isSynced) === 1,
        isInstrumental: Number(row.isInstrumental) === 1,
        language: row.language ? String(row.language) : null,
        fetchedAt: Number(row.fetchedAt),
        songTitle: row.songTitle ? String(row.songTitle) : null,
        artistName: row.artistName ? String(row.artistName) : null,
        albumId: row.albumId ? String(row.albumId) : null,
        coverArt: row.coverArt ? String(row.coverArt) : null,
        songDuration:
          row.songDuration !== null && row.songDuration !== undefined
            ? Number(row.songDuration)
            : null,
      }
    } catch (error) {
      logger.error('getLyrics failed', error)
      return null
    }
  }

  saveLyrics(record: LyricsRecord): void {
    if (!this.db) return
    try {
      const stmt = this.db.prepare(`
        INSERT INTO lyrics (
          songId, serverId, source, plainText, syncedLrc,
          isSynced, isInstrumental, language, fetchedAt,
          songTitle, artistName, albumId, coverArt, songDuration
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(songId, serverId) DO UPDATE SET
          source = excluded.source,
          plainText = excluded.plainText,
          syncedLrc = excluded.syncedLrc,
          isSynced = excluded.isSynced,
          isInstrumental = excluded.isInstrumental,
          language = excluded.language,
          fetchedAt = excluded.fetchedAt,
          songTitle = COALESCE(excluded.songTitle, lyrics.songTitle),
          artistName = COALESCE(excluded.artistName, lyrics.artistName),
          albumId = COALESCE(excluded.albumId, lyrics.albumId),
          coverArt = COALESCE(excluded.coverArt, lyrics.coverArt),
          songDuration = COALESCE(excluded.songDuration, lyrics.songDuration)
      `)

      stmt.run(
        record.songId,
        record.serverId,
        record.source,
        record.plainText,
        record.syncedLrc,
        record.isSynced ? 1 : 0,
        record.isInstrumental ? 1 : 0,
        record.language ?? null,
        record.fetchedAt,
        record.songTitle ?? null,
        record.artistName ?? null,
        record.albumId ?? null,
        record.coverArt ?? null,
        record.songDuration ?? null,
      )
    } catch (error) {
      logger.error('saveLyrics failed', error)
    }
  }

  updateMetadata(
    songId: string,
    serverId: string,
    title: string,
    artist?: string | null,
    albumId?: string | null,
    coverArt?: string | null,
    duration?: number | null,
  ): void {
    if (!this.db) return
    try {
      const stmt = this.db.prepare(`
        UPDATE lyrics
        SET songTitle = ?,
            artistName = ?,
            albumId = COALESCE(?, albumId),
            coverArt = ?,
            songDuration = COALESCE(?, songDuration)
        WHERE songId = ? AND serverId = ?
      `)
      stmt.run(
        title,
        artist ?? null,
        albumId ?? null,
        coverArt ?? null,
        duration ?? null,
        songId,
        serverId,
      )
    } catch (error) {
      logger.error('updateMetadata failed', error)
    }
  }

  cachedSongIds(serverId: string): Set<string> {
    if (!this.db) return new Set()
    try {
      const stmt = this.db.prepare(
        "SELECT songId FROM lyrics WHERE serverId = ? AND source != 'none'",
      )
      const rows = stmt.all(serverId) as { songId: string }[]
      return new Set(rows.map((r) => r.songId))
    } catch (error) {
      logger.error('cachedSongIds failed', error)
      return new Set()
    }
  }

  fetchedCount(serverId: string): number {
    if (!this.db) return 0
    try {
      const stmt = this.db.prepare(
        "SELECT COUNT(*) as count FROM lyrics WHERE serverId = ? AND source != 'none'",
      )
      const row = stmt.get(serverId) as { count: number } | undefined
      return row?.count ?? 0
    } catch (error) {
      logger.error('fetchedCount failed', error)
      return 0
    }
  }

  totalRowCount(serverId?: string): number {
    if (!this.db) return 0
    try {
      const query = serverId
        ? 'SELECT COUNT(*) as count FROM lyrics WHERE serverId = ?'
        : 'SELECT COUNT(*) as count FROM lyrics'
      const stmt = this.db.prepare(query)
      const row = (serverId ? stmt.get(serverId) : stmt.get()) as
        | { count: number }
        | undefined
      return row?.count ?? 0
    } catch (error) {
      logger.error('totalRowCount failed', error)
      return 0
    }
  }

  diskSizeBytes(): number {
    const suffixes = ['', '-wal', '-shm']
    let total = 0
    for (const suffix of suffixes) {
      try {
        const stats = statSync(this.dbPath + suffix)
        total += stats.size
      } catch {
        // file might not exist, ignore
      }
    }
    return total
  }

  reset(serverId: string): void {
    if (!this.db) return
    try {
      this.db.prepare('DELETE FROM lyrics WHERE serverId = ?').run(serverId)
      this.db.exec('VACUUM;')
      logger.info(`lyrics database reset for server ${serverId}`)
    } catch (error) {
      logger.error('lyrics database reset failed', error)
    }
  }

  searchLyrics(
    text: string,
    serverId: string,
    limit = 40,
  ): LyricsSearchResult[] {
    const trimmed = text.trim()
    if (!this.db || !trimmed) return []

    const pattern = `%${trimmed}%`
    try {
      const stmt = this.db.prepare(`
        SELECT songId, songTitle, artistName, albumId, coverArt, plainText, songDuration
        FROM lyrics
        WHERE serverId = ?
          AND source != 'none'
          AND isInstrumental = 0
          AND plainText LIKE ? COLLATE NOCASE
        ORDER BY COALESCE(songTitle, songId)
        LIMIT ?
      `)

      const rows = stmt.all(serverId, pattern, limit) as {
        songId: string
        songTitle: string | null
        artistName: string | null
        albumId: string | null
        coverArt: string | null
        plainText: string | null
        songDuration: number | null
      }[]

      return rows.map((row) => {
        const snippet = row.plainText
          ? this.extractSnippet(row.plainText, trimmed)
          : ''
        return {
          id: row.songId,
          songId: row.songId,
          songTitle: row.songTitle,
          artistName: row.artistName,
          albumId: row.albumId,
          coverArt: row.coverArt,
          snippet,
          duration: row.songDuration,
        }
      })
    } catch (error) {
      logger.error('searchLyrics failed', error)
      return []
    }
  }

  private extractSnippet(text: string, query: string): string {
    const lower = query.toLowerCase()
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      if (line.toLowerCase().includes(lower)) {
        return line.trim()
      }
    }
    return ''
  }
}
