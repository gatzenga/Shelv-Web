import { useQuery } from '@tanstack/react-query'
import { subsonic } from '@/service/subsonic'
import { Albums } from '@/types/responses/album'
import { queryKeys } from '@/utils/queryKeys'

const PAGE_SIZE = 500

async function fetchAllAlbums() {
  const albums: Albums[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { list } = await subsonic.albums.getAlbumList({
      type: 'newest',
      size: PAGE_SIZE,
      offset,
    })
    if (!list || list.length === 0) break

    albums.push(...list)
    if (list.length < PAGE_SIZE) break
  }

  return albums
}

// The whole library, sorted and filtered on the client like in the Shelv app.
// The Library screens need all albums at once: the server cannot combine a
// sort order with a genre and a text filter.
export function useAllAlbums(enabled = true) {
  return useQuery({
    queryKey: [queryKeys.album.library],
    queryFn: fetchAllAlbums,
    staleTime: 60_000,
    enabled,
  })
}
