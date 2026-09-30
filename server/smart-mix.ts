// Smart mixes, built by the backend with the credentials of the browser.
// Song selection follows the Shelv player (SmartMixPlaybackService.swift and
// SubsonicAPIService.swift); like there, every mix is played shuffled.
import type { ServerResponse } from 'node:http'
import type { ServerConfig } from './config.ts'
import { mostPlayedSongs } from './frequent-songs.ts'
import { readBooleanParam, sendJson } from './http.ts'
import type { LastFMService } from './lastfm.ts'
import {
  createClient,
  SubsonicError,
  type SubsonicRequest,
} from './subsonic-client.ts'

type MixType = 'newest' | 'frequent' | 'recent' | 'shuffle'

const mixTypes: MixType[] = ['newest', 'frequent', 'recent', 'shuffle']

export interface Album {
  id: string
  playCount?: number
}

export interface Song {
  id: string
  title?: string
  playCount?: number
  played?: string
  [key: string]: unknown
}

export async function albumList(
  request: SubsonicRequest,
  type: string,
  size: number,
) {
  const body = await request<{ albumList2?: { album?: Album[] } }>(
    'getAlbumList2',
    { type, size: String(size) },
  )

  return body.albumList2?.album ?? []
}

// Loads the songs of many albums, a few at a time
export async function songsOfAlbums(request: SubsonicRequest, albums: Album[]) {
  const results: Song[][] = new Array(albums.length)
  let next = 0

  async function worker() {
    while (next < albums.length) {
      const index = next++
      try {
        const body = await request<{ album?: { song?: Song[] } }>('getAlbum', {
          id: albums[index].id,
        })
        results[index] = body.album?.song ?? []
      } catch {
        results[index] = []
      }
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker))

  return results.flat()
}

export function byPlayCount(
  a: { playCount?: number },
  b: { playCount?: number },
) {
  return (b.playCount ?? 0) - (a.playCount ?? 0)
}

// Shelv: getNewestSongs, all songs of the 10 newest albums
async function newestSongs(request: SubsonicRequest) {
  return songsOfAlbums(request, await albumList(request, 'newest', 10))
}

// Shelv: frequentMixFallbackSongs (uses Last.fm if available, else Navidrome)
async function frequentSongs(
  request: SubsonicRequest,
  lastfm?: LastFMService | null,
) {
  if (lastfm) {
    const lastFmSongs = await lastfm.topSongs(request, 50)
    if (lastFmSongs && lastFmSongs.length >= 10) {
      return lastFmSongs
    }
  }

  return mostPlayedSongs(request, await albumList(request, 'frequent', 500), 50)
}

// Shelv: getRecentlyPlayedSongs, the songs of the 30 recently played albums
// that were actually played, most recent play first (uses Last.fm if
// available, else Navidrome). Servers that do not report the play date of a
// song get every song of those albums in order.
async function recentSongs(
  request: SubsonicRequest,
  lastfm?: LastFMService | null,
) {
  if (lastfm) {
    const lastFmSongs = await lastfm.recentSongs(request, 50)
    if (lastFmSongs && lastFmSongs.length >= 10) {
      return lastFmSongs
    }
  }

  const albums = await albumList(request, 'recent', 30)
  const songs = await songsOfAlbums(request, albums)

  const played = songs
    .filter((song) => song.played)
    .sort(
      (a, b) =>
        new Date(b.played as string).getTime() -
        new Date(a.played as string).getTime(),
    )

  return (played.length > 0 ? played : songs).slice(0, 50)
}

// Shelv: shuffleAll
async function shuffleSongs(request: SubsonicRequest) {
  const body = await request<{ randomSongs?: { song?: Song[] } }>(
    'getRandomSongs',
    { size: '500' },
  )

  return body.randomSongs?.song ?? []
}

function shuffle<T>(items: T[]) {
  const result = [...items]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function uniqueById(songs: Song[]) {
  const seen = new Set<string>()

  return songs.filter((song) => {
    if (seen.has(song.id)) return false
    seen.add(song.id)
    return true
  })
}

export async function sendSmartMix(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
  lastfm?: LastFMService | null,
) {
  const type = url.searchParams.get('type') as MixType | null

  if (!type || !mixTypes.includes(type)) {
    sendJson(res, 400, { error: `type must be one of ${mixTypes.join(', ')}` })
    return
  }

  const request = createClient(config, url.searchParams)
  const mixLastfm = readBooleanParam(
    url.searchParams,
    'mixes',
    config.client.lastfmDefaults.mixes,
  )
    ? lastfm
    : null
  const load = {
    newest: (req: SubsonicRequest) => newestSongs(req),
    frequent: (req: SubsonicRequest) => frequentSongs(req, mixLastfm),
    recent: (req: SubsonicRequest) => recentSongs(req, mixLastfm),
    shuffle: (req: SubsonicRequest) => shuffleSongs(req),
  }[type]

  try {
    const songs = shuffle(uniqueById(await load(request)))

    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, { songs })
  } catch (error) {
    if (!(error instanceof SubsonicError)) throw error
    sendJson(res, 502, { error: 'smart mix could not be created' })
  }
}
