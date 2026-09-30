import { getBackendUrl, httpClient } from '@/api/httpClient'
import {
  FavoritesResponse,
  GetSongResponse,
  ISong,
  RandomSongsResponse,
  TopSongsResponse,
} from '@/types/responses/song'
import { search } from './search'

interface GetRandomSongsParams {
  size?: number
  genre?: string
  fromYear?: number
  toYear?: number
}

async function getRandomSongs({
  size,
  genre,
  fromYear,
  toYear,
}: GetRandomSongsParams) {
  const response = await httpClient<RandomSongsResponse>('/getRandomSongs', {
    method: 'GET',
    query: {
      size: size?.toString(),
      genre,
      fromYear: fromYear?.toString(),
      toYear: toYear?.toString(),
    },
  })

  return response?.data.randomSongs.song
}

async function getFavoriteSongs() {
  const response = await httpClient<FavoritesResponse>('/getStarred2', {
    method: 'GET',
  })

  return response?.data.starred2
}

async function getTopSongs(artistName: string) {
  const response = await httpClient<TopSongsResponse>('/getTopSongs', {
    method: 'GET',
    query: {
      artist: artistName,
    },
  })

  return response?.data.topSongs.song
}

// Ranked by the backend from the play counts of the server or, when the
// Top Songs option of Last.fm is on, from Last.fm's popular tracks
async function getArtistTopSongs(artistId: string, lastfm: boolean) {
  const response = await fetch(
    getBackendUrl('/api/artist-top-songs', {
      artistId,
      topSongs: String(lastfm),
    }),
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error(`top songs failed: ${response.status}`)

  const { songs } = (await response.json()) as { songs: ISong[] }

  return songs
}

async function getAllSongs(songCount: number) {
  const response = await search.get({
    query: '',
    albumCount: 0,
    artistCount: 0,
    songCount,
    songOffset: 0,
  })

  return response?.song ?? []
}

async function getSong(id: string) {
  const response = await httpClient<GetSongResponse>('/getSong', {
    method: 'GET',
    query: {
      id,
    },
  })

  return response?.data.song
}

export const songs = {
  getAllSongs,
  getFavoriteSongs,
  getRandomSongs,
  getTopSongs,
  getArtistTopSongs,
  getSong,
}
