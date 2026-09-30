import { subsonic } from '@/service/subsonic'

export async function getFavorites() {
  const response = await subsonic.songs.getFavoriteSongs()

  return {
    songs: response?.song ?? [],
    albums: response?.album ?? [],
    artists: response?.artist ?? [],
  }
}
