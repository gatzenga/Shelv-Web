import { Albums } from '@/types/responses/album'
import { ISong } from '@/types/responses/song'

// At most as many songs as the Shelv app queues when playing a whole list
export const MAX_QUEUE_SONGS = 500
const CONCURRENT_ALBUM_LOADS = 8

export function shuffleList<T>(list: T[]) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface QueueOptions {
  albums: Albums[]
  // songs that are added to the ones of the albums, e.g. favorite songs
  songs?: ISong[]
  shuffle: boolean
  loadAlbumSongs: (albumId: string) => Promise<ISong[] | undefined>
}

// The songs of a list of albums as a queue. Albums are loaded in batches only
// until the queue is full. When shuffled, the albums are picked in random
// order instead of loading all of them.
export async function buildLibraryQueue({
  albums,
  songs = [],
  shuffle,
  loadAlbumSongs,
}: QueueOptions) {
  const order = shuffle ? shuffleList(albums) : albums
  const queue: ISong[] = [...songs]

  for (
    let start = 0;
    start < order.length && queue.length < MAX_QUEUE_SONGS;
    start += CONCURRENT_ALBUM_LOADS
  ) {
    const batch = order.slice(start, start + CONCURRENT_ALBUM_LOADS)
    const loaded = await Promise.all(
      batch.map((album) => loadAlbumSongs(album.id)),
    )
    queue.push(...loaded.flatMap((albumSongs) => albumSongs ?? []))
  }

  return (shuffle ? shuffleList(queue) : queue).slice(0, MAX_QUEUE_SONGS)
}
