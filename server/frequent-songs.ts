// The most played songs from the play counts of the server, like in the
// Shelv app (SubsonicAPIService.mostPlayedSongs and FrequentSongsCollector).
//
// Goes through the most played albums in order and keeps the best songs,
// until no remaining album can hold a song that beats the current last
// place. An album's plays are the sum of its songs' plays, so no song can
// have more plays than its album. The result is exact, and only as many
// albums are loaded as that takes.
import { type Album, type Song, songsOfAlbums } from './smart-mix.ts'
import type { SubsonicRequest } from './subsonic-client.ts'

const batchSize = 8

class FrequentSongsCollector {
  top: Song[] = []

  private limit: number

  constructor(limit: number) {
    this.limit = limit
  }

  // Plays an album has to beat to be worth loading: those of the song in
  // last place once the list is full, zero before that
  private get cutoff() {
    if (this.top.length < this.limit) return 0

    return this.top[this.top.length - 1]?.playCount ?? 0
  }

  isWorthLoading(album: Album) {
    return (album.playCount ?? 0) > this.cutoff
  }

  // Songs that were never played only pad the list and are left out
  add(songs: Song[]) {
    const played = songs.filter((song) => (song.playCount ?? 0) > 0)
    if (played.length === 0) return

    this.top = [...this.top, ...played]
      .map((song, offset) => ({ song, offset }))
      .sort((a, b) => {
        const difference = (b.song.playCount ?? 0) - (a.song.playCount ?? 0)

        return difference !== 0 ? difference : a.offset - b.offset
      })
      .slice(0, this.limit)
      .map(({ song }) => song)
  }
}

export async function mostPlayedSongs(
  request: SubsonicRequest,
  frequentAlbums: Album[],
  limit: number,
) {
  const albums = [...frequentAlbums].sort(
    (a, b) => (b.playCount ?? 0) - (a.playCount ?? 0),
  )
  const collector = new FrequentSongsCollector(limit)
  // For servers that report no play counts on songs: the first albums' songs
  let firstLoaded: Song[] = []

  for (let index = 0; index < albums.length; index += batchSize) {
    // Sorted by play count, so once the first one of a batch is not worth
    // loading, nothing after it is either
    const batch = albums
      .slice(index, index + batchSize)
      .filter((album) => collector.isWorthLoading(album))
    if (batch.length === 0) break

    const loaded = await songsOfAlbums(request, batch)
    if (firstLoaded.length === 0) firstLoaded = loaded
    collector.add(loaded)
  }

  return collector.top.length > 0 ? collector.top : firstLoaded.slice(0, limit)
}
