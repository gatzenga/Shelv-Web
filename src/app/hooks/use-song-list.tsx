import { getPersistedAlbumSort } from '@/app/components/artist/album-sort'
import { sortAlbums } from '@/app/components/library/sorting'
import { subsonic } from '@/service/subsonic'
import { getLastFMOptions } from '@/store/lastfm-options.store'
import { Albums } from '@/types/responses/album'
import { ISong } from '@/types/responses/song'

export function buildArtistPlayOrder(
  topSongs: ISong[],
  discographySongs: ISong[],
): ISong[] {
  const seenIds = new Set<string>()
  const result: ISong[] = []

  // 1. First 8 top songs
  for (const song of topSongs.slice(0, 8)) {
    if (!seenIds.has(song.id)) {
      seenIds.add(song.id)
      result.push(song)
    }
  }

  // 2. Discography songs in sorted album track order
  for (const song of discographySongs) {
    if (!seenIds.has(song.id)) {
      seenIds.add(song.id)
      result.push(song)
    }
  }

  return result
}

export function useSongList() {
  async function getArtistSongCount(id: string) {
    const response = await subsonic.artists.getOne(id)
    let count = 0

    if (!response || !response.album) return count

    response.album.forEach((item) => {
      count += item.songCount
    })

    return count
  }

  async function getArtistAllSongs(name: string) {
    const response = await subsonic.search.get({
      query: name,
      songCount: 9999999,
      albumCount: 0,
      artistCount: 0,
    })

    if (!response || !response.song) return undefined

    return response.song
  }

  async function getAlbumSongs(albumId: string) {
    const songs = await subsonic.albums.getOne(albumId)

    if (!songs || !songs.song) return undefined

    return songs.song
  }

  async function getArtistPlayOrderSongs({
    artistId,
    artistName,
    sortedAlbums,
    topSongs,
  }: {
    artistId: string
    artistName?: string
    sortedAlbums?: Albums[]
    topSongs?: ISong[]
  }): Promise<ISong[]> {
    let albums = sortedAlbums
    if (!albums || albums.length === 0) {
      try {
        const response = await subsonic.artists.getOne(artistId)
        if (response?.album && response.album.length > 0) {
          const { sortOption, direction } = getPersistedAlbumSort()
          albums = sortAlbums(response.album, sortOption, direction)
        } else {
          albums = []
        }
      } catch {
        albums = []
      }
    }

    let top = topSongs
    if (!top) {
      try {
        const { topSongs: useLastFm } = getLastFMOptions()
        top = await subsonic.songs.getArtistTopSongs(artistId, useLastFm)
      } catch {
        top = []
      }
    }

    // Load each album's tracks in order
    const albumsWithSongs = await Promise.all(
      albums.map(async (album) => {
        try {
          return (await getAlbumSongs(album.id)) ?? []
        } catch {
          return []
        }
      }),
    )

    const discographySongs = albumsWithSongs.flat()
    const playOrderSongs = buildArtistPlayOrder(top ?? [], discographySongs)

    // Fallback: if no albums / tracks found, fall back to searching artist songs
    if (playOrderSongs.length === 0 && artistName) {
      const fallback = await getArtistAllSongs(artistName)
      if (fallback && fallback.length > 0) return fallback
    }

    return playOrderSongs
  }

  return {
    getArtistSongCount,
    getArtistAllSongs,
    getAlbumSongs,
    getArtistPlayOrderSongs,
  }
}
