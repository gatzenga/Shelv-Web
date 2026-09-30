import { subsonic } from '@/service/subsonic'

export async function getFavoriteSongs() {
  const response = await subsonic.songs.getFavoriteSongs()

  if (!response || !response.song) return { songs: [] }

  return { songs: response.song }
}
