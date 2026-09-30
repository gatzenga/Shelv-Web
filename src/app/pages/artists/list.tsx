import { useQuery } from '@tanstack/react-query'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { ArtistGridCard } from '@/app/components/artist/artist-grid-card'
import { ArtistsFallback } from '@/app/components/fallbacks/artists.tsx'
import { GridViewWrapper } from '@/app/components/grid-view-wrapper'
import { HeaderTitle } from '@/app/components/header-title'
import { LibraryPage } from '@/app/components/library/page'
import {
  ArtistSortOption,
  artistSortOptions,
  naturalDirection,
  SortDirection,
  sortArtists,
  sortOptionLabelKey,
} from '@/app/components/library/sorting'
import {
  LibraryDirectionButton,
  LibraryFilterInput,
  LibrarySortMenu,
  LibraryToolbar,
  LibraryViewToggle,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { DataTable } from '@/app/components/ui/data-table'
import { useAllAlbums } from '@/app/hooks/use-all-albums'
import { usePersistedState } from '@/app/hooks/use-persisted-state'
import { useSongList } from '@/app/hooks/use-song-list'
import { useUrlParam } from '@/app/hooks/use-url-param'
import { artistsColumns } from '@/app/tables/artists-columns'
import { subsonic } from '@/service/subsonic'
import { useAppArtistsViewType } from '@/store/app.store'
import { usePlayerActions } from '@/store/player.store'
import { ISimilarArtist } from '@/types/responses/artist'
import { queryKeys } from '@/utils/queryKeys'

const MemoShadowHeader = memo(ShadowHeader)
const MemoHeaderTitle = memo(HeaderTitle)
const MemoDataTable = memo(DataTable) as typeof DataTable
const MemoListWrapper = memo(ListWrapper)

const isSortOption = (value: unknown): value is ArtistSortOption =>
  artistSortOptions.includes(value as ArtistSortOption)
const isDirection = (value: unknown): value is SortDirection =>
  value === 'asc' || value === 'desc'

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

  const [query, setQuery] = useUrlParam('query')
  const [sortOption, setSortOption] = usePersistedState<ArtistSortOption>(
    'artists-page-sort',
    'name',
    isSortOption,
  )
  const [direction, setDirection] = usePersistedState<SortDirection>(
    'artists-page-direction',
    'desc',
    isDirection,
  )

  const { data: allArtists, isLoading } = useQuery({
    queryKey: [queryKeys.artist.all],
    queryFn: subsonic.artists.getAll,
  })
  // The plays of an artist are the plays of their albums
  const { data: allAlbums } = useAllAlbums(sortOption === 'mostPlayed')

  async function handlePlayArtistRadio(artist: ISimilarArtist) {
    const songList = await getArtistAllSongs(artist.name)

    if (songList)
      setSongList(songList, 0, false, {
        id: artist.id,
        name: artist.name,
        type: 'artist',
      })
  }

  const artists = useMemo(() => {
    if (!allArtists) return undefined

    const search = query.trim().toLowerCase()
    const filtered = search
      ? allArtists.filter((artist) =>
          artist.name.toLowerCase().includes(search),
        )
      : allArtists

    return sortArtists(filtered, allAlbums ?? [], sortOption, direction)
  }, [allArtists, allAlbums, query, sortOption, direction])

  function changeSort(option: ArtistSortOption) {
    setSortOption(option)
    setDirection(naturalDirection(option))
  }

  if (isLoading) return <ArtistsFallback />
  if (!artists) return null

  return (
    <LibraryPage
      header={
        <>
          <MemoShadowHeader fixed={false} showGlassEffect={false}>
            <MemoHeaderTitle
              title={t('sidebar.artists')}
              count={artists.length}
            />
          </MemoShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />

            <div className="flex items-center gap-2 ml-auto">
              <LibrarySortMenu
                options={artistSortOptions}
                value={sortOption}
                labelKey={(option) => sortOptionLabelKey[option]}
                onChange={changeSort}
              />

              {sortOption !== 'name' && (
                <LibraryDirectionButton
                  direction={direction}
                  onToggle={() =>
                    setDirection(direction === 'asc' ? 'desc' : 'asc')
                  }
                />
              )}

              <LibraryViewToggle
                viewType={artistsPageViewType}
                onChange={setArtistsPageViewType}
              />
            </div>
          </LibraryToolbar>
        </>
      }
    >
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
            enableSorting={false}
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
    </LibraryPage>
  )
}
