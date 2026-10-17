import { useQuery } from '@tanstack/react-query'
import type { DiscoverList } from '@/routes/routesList'
import { subsonic } from '@/service/subsonic'
import { convertMinutesToMs } from '@/utils/convertSecondsToTime'
import { discoverPreviewSize } from '@/utils/listSizes'
import { queryKeys } from '@/utils/queryKeys'

// The lists of the Discover page: what Navidrome calls them, and the key
const lists = {
  'recently-added': { type: 'newest', key: queryKeys.album.recentlyAdded },
  'frequently-played': { type: 'frequent', key: queryKeys.album.mostPlayed },
  'recently-played': { type: 'recent', key: queryKeys.album.recentlyPlayed },
  'random-albums': { type: 'random', key: queryKeys.album.random },
} as const

export const useGetDiscoverAlbums = (
  list: DiscoverList,
  size = discoverPreviewSize,
) => {
  const { type, key } = lists[list]

  return useQuery({
    queryKey: [key, size],
    queryFn: () => subsonic.albums.getAlbumList({ size, type }),
    refetchInterval:
      list === 'recently-played' ? convertMinutesToMs(2) : undefined,
  })
}

export const useGetRecentlyAdded = () => useGetDiscoverAlbums('recently-added')
export const useGetMostPlayed = () => useGetDiscoverAlbums('frequently-played')
export const useGetRecentlyPlayed = () =>
  useGetDiscoverAlbums('recently-played')
export const useGetRandomAlbums = () => useGetDiscoverAlbums('random-albums')
