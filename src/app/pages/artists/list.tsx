import { useQuery } from '@tanstack/react-query'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { ArtistGridCard } from '@/app/components/artist/artist-grid-card'
import {
  ArtistsFilters,
  filterAndSortArtists,
  useArtistsFilters,
} from '@/app/components/artist/list-filters'
import { ArtistsFallback } from '@/app/components/fallbacks/artists.tsx'
import { GridViewWrapper } from '@/app/components/grid-view-wrapper'
import { HeaderTitle } from '@/app/components/header-title'
import ListWrapper from '@/app/components/list-wrapper'
import { MainViewTypeSelector } from '@/app/components/main-grid'
import { DataTable } from '@/app/components/ui/data-table'
import { useSongList } from '@/app/hooks/use-song-list'
import { artistsColumns } from '@/app/tables/artists-columns'
import { subsonic } from '@/service/subsonic'
import { useAppArtistsViewType } from '@/store/app.store'
import { usePlayerActions } from '@/store/player.store'
import { ISimilarArtist } from '@/types/responses/artist'
import { queryKeys } from '@/utils/queryKeys'

const MemoShadowHeader = memo(ShadowHeader)
const MemoHeaderTitle = memo(HeaderTitle)
const MemoViewTypeSelector = memo(MainViewTypeSelector)
const MemoDataTable = memo(DataTable) as typeof DataTable
const MemoListWrapper = memo(ListWrapper)

export default function ArtistsList() {
  const { t } = useTranslation()
  const { getArtistAllSongs } = useSongList()
  const { setSongList } = usePlayerActions()
  const {
    artistsPageViewType,
    setArtistsPageViewType,
    isTableView,
    isGridView,
  } = useAppArtistsViewType()

  const columns = artistsColumns()
  const filters = useArtistsFilters()

  const { data: allArtists, isLoading } = useQuery({
    queryKey: [queryKeys.artist.all],
    queryFn: subsonic.artists.getAll,
  })

  async function handlePlayArtistRadio(artist: ISimilarArtist) {
    const songList = await getArtistAllSongs(artist.name)

    if (songList)
      setSongList(songList, 0, false, {
        id: artist.id,
        name: artist.name,
        type: 'artist',
      })
  }

  const { sortBy, order, query } = filters
  const artists = useMemo(
    () =>
      allArtists
        ? filterAndSortArtists(allArtists, { sortBy, order, query })
        : undefined,
    [allArtists, sortBy, order, query],
  )

  if (isLoading) return <ArtistsFallback />
  if (!artists) return null

  return (
    <div className="w-full h-full">
      <MemoShadowHeader className="flex justify-between">
        <MemoHeaderTitle title={t('sidebar.artists')} count={artists.length} />

        <div className="flex gap-2 items-center">
          <ArtistsFilters filters={filters} />
          <MemoViewTypeSelector
            viewType={artistsPageViewType}
            setViewType={setArtistsPageViewType}
          />
        </div>
      </MemoShadowHeader>

      {isTableView && (
        <MemoListWrapper>
          <MemoDataTable
            columns={columns}
            data={artists}
            showPagination={true}
            showSearch={false}
            searchColumn="name"
            handlePlaySong={(row) => handlePlayArtistRadio(row.original)}
            allowRowSelection={false}
            dataType="artist"
          />
        </MemoListWrapper>
      )}

      {isGridView && (
        <MemoListWrapper className="px-0">
          <GridViewWrapper
            list={artists}
            data-testid="artists-grid"
            type="artists"
          >
            {(artist) => <ArtistGridCard artist={artist} />}
          </GridViewWrapper>
        </MemoListWrapper>
      )}
    </div>
  )
}
