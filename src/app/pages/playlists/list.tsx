import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ShadowHeader } from '@/app/components/album/shadow-header'
import { SongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { HeaderTitle } from '@/app/components/header-title'
import { LibraryPage } from '@/app/components/library/page'
import {
  LibraryFilterInput,
  LibraryToolbar,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { EmptyPlaylistsPage } from '@/app/components/playlist/empty-page'
import { Button } from '@/app/components/ui/button'
import { DataTable } from '@/app/components/ui/data-table'
import { useUrlParam } from '@/app/hooks/use-url-param'
import { playlistsColumns } from '@/app/tables/playlists-columns'
import { subsonic } from '@/service/subsonic'
import { usePlayerActions } from '@/store/player.store'
import { usePlaylists } from '@/store/playlists.store'
import { queryKeys } from '@/utils/queryKeys'

export default function PlaylistsPage() {
  const { setPlaylistDialogState } = usePlaylists()
  const { setSongList } = usePlayerActions()
  const { t } = useTranslation()

  const { data: playlists, isLoading } = useQuery({
    queryKey: [queryKeys.playlist.all],
    queryFn: subsonic.playlists.getAll,
  })

  const columns = playlistsColumns()
  const [query, setQuery] = useUrlParam('query')

  const filteredPlaylists = useMemo(() => {
    const search = query.trim().toLowerCase()

    return (playlists ?? []).filter(
      (playlist) => !search || playlist.name.toLowerCase().includes(search),
    )
  }, [playlists, query])

  async function handlePlayPlaylist(playlistId: string) {
    const playlist = await subsonic.playlists.getOne(playlistId)

    if (playlist && playlist.entry.length > 0) {
      setSongList(playlist.entry, 0, false, {
        id: playlist.id,
        name: playlist.name,
        type: 'playlist',
      })
    }
  }

  if (isLoading) return <SongListFallback />
  if (!playlists) return null

  const showTable = playlists.length > 0

  return (
    <LibraryPage
      header={
        <>
          <ShadowHeader fixed={false} showGlassEffect={false}>
            <HeaderTitle
              title={t('sidebar.playlists')}
              count={filteredPlaylists.length}
            />
          </ShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />

            <Button
              size="sm"
              variant="default"
              className="ml-auto px-4"
              onClick={() => setPlaylistDialogState(true)}
            >
              <PlusIcon className="w-5 h-5 -ml-[3px]" />
              <span className="ml-2">{t('playlist.form.create.title')}</span>
            </Button>
          </LibraryToolbar>
        </>
      }
    >
      {!showTable && <EmptyPlaylistsPage />}

      {showTable && (
        <ListWrapper>
          <DataTable
            columns={columns}
            data={filteredPlaylists}
            showPagination={true}
            showSearch={false}
            handlePlaySong={(row) => handlePlayPlaylist(row.original.id)}
            allowRowSelection={false}
            dataType="playlist"
            noRowsMessage={t('options.playlist.notFound')}
          />
        </ListWrapper>
      )}
    </LibraryPage>
  )
}
