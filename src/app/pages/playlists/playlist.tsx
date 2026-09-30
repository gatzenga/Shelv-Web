import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { DetailHeader } from '@/app/components/detail/header'
import { PlaylistFallback } from '@/app/components/fallbacks/playlist-fallbacks'
import ListWrapper from '@/app/components/list-wrapper'
import { PlaylistButtons } from '@/app/components/playlist/buttons'
import { RemoveSongFromPlaylistDialog } from '@/app/components/playlist/remove-song-dialog'
import { DataTable } from '@/app/components/ui/data-table'
import ErrorPage from '@/app/pages/error-page'
import { songsColumns } from '@/app/tables/songs-columns'
import { subsonic } from '@/service/subsonic'
import { usePlayerActions } from '@/store/player.store'
import { ColumnFilter } from '@/types/columnFilter'
import { convertSecondsToHumanRead } from '@/utils/convertSecondsToTime'
import { queryKeys } from '@/utils/queryKeys'

export default function Playlist() {
  const { playlistId } = useParams() as { playlistId: string }
  const { t } = useTranslation()
  const columns = songsColumns()
  const { setSongList } = usePlayerActions()

  const {
    data: playlist,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [queryKeys.playlist.single, playlistId],
    queryFn: () => subsonic.playlists.getOne(playlistId),
  })

  if (isFetching || isLoading) return <PlaylistFallback />
  if (!playlist) return <ErrorPage status={404} statusText="Not Found" />

  const columnsToShow: ColumnFilter[] = [
    'index',
    'title',
    'album',
    'duration',
    'playCount',
    'contentType',
    'select',
  ]

  const hasSongs = playlist.songCount > 0
  const duration = convertSecondsToHumanRead(playlist.duration)

  const songCount = hasSongs
    ? t('playlist.songCount', { count: playlist.songCount })
    : null
  const playlistDuration = hasSongs
    ? t('playlist.duration', { duration })
    : null

  const details = [songCount, playlistDuration].filter(Boolean).join(' · ')

  const coverArt = playlist.songCount > 0 ? playlist.coverArt : undefined

  return (
    <div className="w-full relative" key={playlist.id}>
      <DetailHeader
        coverArtId={coverArt}
        coverArtType="album"
        title={playlist.name}
        actions={<PlaylistButtons playlist={playlist} />}
      >
        {playlist.comment && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {playlist.comment}
          </p>
        )}
        {details && <p className="text-xs text-muted-foreground">{details}</p>}
      </DetailHeader>

      <ListWrapper>
        <DataTable
          columns={columns}
          data={playlist.entry ?? []}
          handlePlaySong={(row) => {
            setSongList(playlist.entry, row.index, false, {
              id: playlist.id,
              name: playlist.name,
              type: 'playlist',
            })
          }}
          columnFilter={columnsToShow}
          noRowsMessage={t('playlist.noSongList')}
          variant="modern"
          enableVirtualization={true}
        />

        <RemoveSongFromPlaylistDialog />
      </ListWrapper>
    </div>
  )
}
