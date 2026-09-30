// Top songs of an artist, built by the backend with the credentials of the
// browser. Follows the Shelv player (ArtistTopSongsService.swift): the play
// counts of the server decide, unless the Top Songs option of Last.fm is on,
// which ranks the artist's songs by Last.fm's popular tracks instead.
import type { ServerResponse } from 'node:http'
import type { ServerConfig } from './config.ts'
import { readBooleanParam, sendJson } from './http.ts'
import type { LastFMService } from './lastfm.ts'
import { lastfmLog } from './lastfm-log.ts'
import { bestMatch, type LibrarySong } from './lastfm-matcher.ts'
import {
  type Album,
  byPlayCount,
  type Song,
  songsOfAlbums,
} from './smart-mix.ts'
import {
  createClient,
  SubsonicError,
  type SubsonicRequest,
} from './subsonic-client.ts'

const songLimit = 10
const playCountAlbumLimit = 25
const lastfmAlbumLimit = 40

function titleKey(title = '') {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// The same track often exists on an album, a single and a compilation
function uniqueByTitle(songs: Song[]) {
  const seen = new Set<string>()

  return songs.filter((song) => {
    const key = titleKey(song.title)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mostPlayedAlbums(albums: Album[], limit: number) {
  return [...albums].sort(byPlayCount).slice(0, limit)
}

// Never-played tracks are dropped, an untouched library has no top songs
function playCountTopSongs(songs: Song[]) {
  const played = songs
    .filter((song) => (song.playCount ?? 0) > 0)
    .sort(byPlayCount)

  return uniqueByTitle(played).slice(0, songLimit)
}

// Last.fm's popular tracks in Last.fm's order, resolved to the artist's own
// songs. Tracks that are not in the library are skipped.
async function lastfmTopSongs(
  request: SubsonicRequest,
  artistName: string,
  albums: Album[],
  lastfm: LastFMService,
) {
  const tracks = await lastfm.artistTopTracks(artistName)
  if (!tracks || albums.length === 0) return null

  const songs = await songsOfAlbums(
    request,
    mostPlayedAlbums(albums, lastfmAlbumLimit),
  )

  const ranked: Song[] = []
  const seen = new Set<string>()

  for (const track of tracks) {
    const song = bestMatch(track, songs as LibrarySong[]) as Song | null
    if (!song) continue

    const key = titleKey(song.title)
    if (seen.has(key)) continue
    seen.add(key)

    ranked.push(song)
    if (ranked.length === songLimit) break
  }

  if (ranked.length === 0) {
    lastfmLog.failure(
      `Top Songs: none of ${tracks.length} Last.fm tracks for ${artistName} is in your library, using play counts`,
    )
    return null
  }

  lastfmLog.success(
    `Top Songs: ${ranked.length} of ${tracks.length} Last.fm tracks for ${artistName} found in your library`,
  )
  return ranked
}

export async function sendArtistTopSongs(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
  lastfm?: LastFMService | null,
) {
  const artistId = url.searchParams.get('artistId')

  if (!artistId) {
    sendJson(res, 400, { error: 'artistId is required' })
    return
  }

  const request = createClient(config, url.searchParams)
  const useLastfm = readBooleanParam(
    url.searchParams,
    'topSongs',
    config.client.lastfmDefaults.topSongs,
  )

  try {
    const { artist } = await request<{
      artist: { name: string; album?: Album[] }
    }>('getArtist', { id: artistId })
    const albums = artist.album ?? []

    const songs =
      (useLastfm &&
        lastfm &&
        (await lastfmTopSongs(request, artist.name, albums, lastfm))) ||
      playCountTopSongs(
        await songsOfAlbums(
          request,
          mostPlayedAlbums(albums, playCountAlbumLimit),
        ),
      )

    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, { songs })
  } catch (error) {
    if (!(error instanceof SubsonicError)) throw error
    sendJson(res, 502, { error: 'top songs could not be loaded' })
  }
}
