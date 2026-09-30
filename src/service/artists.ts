import { httpClient } from '@/api/httpClient'
import {
  ArtistInfoResponse,
  ArtistResponse,
  ArtistsResponse,
  ISimilarArtist,
} from '@/types/responses/artist'

async function getAll() {
  const response = await httpClient<ArtistsResponse>('/getArtists', {
    method: 'GET',
  })

  if (!response) return []

  const artistsList: ISimilarArtist[] = []

  response.data.artists.index.forEach((item) => {
    artistsList.push(...item.artist)
  })

  return artistsList.sort((a, b) => a.name.localeCompare(b.name))
}

async function getOne(id: string) {
  const response = await httpClient<ArtistResponse>('/getArtist', {
    method: 'GET',
    query: {
      id,
    },
  })

  return response?.data.artist
}

// Not every similar artist is in the library, so more are asked for than shown
const similarArtistCount = '50'

async function getInfo(id: string) {
  const response = await httpClient<ArtistInfoResponse>('/getArtistInfo2', {
    method: 'GET',
    query: {
      id,
      count: similarArtistCount,
    },
  })

  if (response?.data.artistInfo2 || response?.data.artistInfo) {
    return response.data.artistInfo2 ?? response.data.artistInfo
  }

  const fallback = await httpClient<ArtistInfoResponse>('/getArtistInfo', {
    method: 'GET',
    query: {
      id,
      count: similarArtistCount,
    },
  })

  return fallback?.data.artistInfo
}

export const artists = {
  getOne,
  getInfo,
  getAll,
}
