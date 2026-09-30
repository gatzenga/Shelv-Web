import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AlbumHeader } from '@/app/components/album/header'
import { AlbumInfo } from '@/app/components/album/info'
import { AlbumTrackList } from '@/app/components/album/track-list'
import { TrackSummary } from '@/app/components/album/track-summary'
import { AlbumFallback } from '@/app/components/fallbacks/album-fallbacks'
import { useGetAlbum } from '@/app/hooks/use-album'
import ErrorPage from '@/app/pages/error-page'
import { usePlayerActions } from '@/store/player.store'

export default function Album() {
  const { albumId } = useParams() as { albumId: string }
  const { setSongList } = usePlayerActions()

  const {
    data: album,
    isLoading: albumIsLoading,
    isFetched,
  } = useGetAlbum(albumId)

  const songs = useMemo(() => {
    if (!album?.song) return []
    return [...album.song].sort(
      (a, b) =>
        (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
        (a.track ?? 0) - (b.track ?? 0),
    )
  }, [album?.song])

  if (albumIsLoading) return <AlbumFallback />
  if (isFetched && !album) {
    return <ErrorPage status={404} statusText="Not Found" />
  }
  if (!album) return <AlbumFallback />

  return (
    <div className="w-full relative">
      <AlbumHeader album={album}>
        <AlbumInfo album={album} />
      </AlbumHeader>

      <AlbumTrackList
        songs={songs}
        onPlay={(index) =>
          setSongList(songs, index, false, {
            id: album.id,
            name: album.name,
            type: 'album',
          })
        }
      />

      <TrackSummary songs={songs} duration={album.duration} />
    </div>
  )
}
