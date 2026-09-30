import { useQuery } from '@tanstack/react-query'
import { subsonic } from '@/service/subsonic'
import { useLastFMTopSongs } from '@/store/lastfm-options.store'
import { IArtist } from '@/types/responses/artist'
import { queryKeys } from '@/utils/queryKeys'

export const useGetArtist = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.single, artistId],
    queryFn: () => subsonic.artists.getOne(artistId),
    enabled: !!artistId,
  })
}

export const useGetArtistInfo = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.info, artistId],
    queryFn: () => subsonic.artists.getInfo(artistId),
    enabled: !!artistId,
  })
}

export const useGetTopSongs = (artist?: IArtist) => {
  const lastfm = useLastFMTopSongs()

  return useQuery({
    queryKey: [queryKeys.artist.topSongs, artist?.id, lastfm],
    queryFn: () => subsonic.songs.getArtistTopSongs(artist?.id ?? '', lastfm),
    enabled: !!artist?.id,
  })
}
