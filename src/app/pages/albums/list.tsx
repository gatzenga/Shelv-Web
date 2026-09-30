import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { AlbumGridCard } from '@/app/components/albums/album-grid-card'
import { EmptyAlbums } from '@/app/components/albums/empty-page'
import { AlbumsFallback } from '@/app/components/fallbacks/album-fallbacks'
import { GridViewWrapper } from '@/app/components/grid-view-wrapper'
import { HeaderTitle } from '@/app/components/header-title'
import {
  AlbumSortOption,
  albumSortOptions,
  allowsDirection,
  genreOptions,
  matchesGenre,
  naturalDirection,
  SortDirection,
  sortAlbums,
  sortOptionLabelKey,
} from '@/app/components/library/sorting'
import {
  LibraryDirectionButton,
  LibraryFilterInput,
  LibraryGenreSelect,
  LibraryPlaybackButtons,
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
import { albumsColumns } from '@/app/tables/albums-columns'
import { useAppStore } from '@/store/app.store'
import { usePlayerActions } from '@/store/player.store'
import { Albums } from '@/types/responses/album'
import { ISong } from '@/types/responses/song'
import { PageViewType } from '@/types/serverConfig'
import { AlbumsFilters, AlbumsSearchParams } from '@/utils/albumsFilter'

// At most as many songs as the Shelv app queues when playing a whole list
const MAX_QUEUE_SONGS = 500
const CONCURRENT_ALBUM_LOADS = 8

const isSortOption = (value: unknown): value is AlbumSortOption =>
  albumSortOptions.includes(value as AlbumSortOption)
const isDirection = (value: unknown): value is SortDirection =>
  value === 'asc' || value === 'desc'
const isViewType = (value: unknown): value is PageViewType =>
  value === 'grid' || value === 'table'

// Links from other pages (genre, search) still open the list with their values
const linkedSortOptions: Record<string, AlbumSortOption> = {
  [AlbumsFilters.ByName]: 'name',
  [AlbumsFilters.ByArtist]: 'artist',
  [AlbumsFilters.MostPlayed]: 'mostPlayed',
  [AlbumsFilters.RecentlyAdded]: 'recentlyAdded',
  [AlbumsFilters.ByYear]: 'year',
}

function shuffle<T>(list: T[]) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default function AlbumsList() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { getAlbumSongs } = useSongList()
  const { setSongList } = usePlayerActions()
  const { data: allAlbums, isLoading } = useAllAlbums()

  const linkedFilter = searchParams.get(AlbumsSearchParams.MainFilter)
  const linkedSort = linkedFilter ? linkedSortOptions[linkedFilter] : undefined

  const [sortOption, setSortOption] = usePersistedState<AlbumSortOption>(
    'albums-page-sort',
    'recentlyAdded',
    isSortOption,
  )
  const [direction, setDirection] = usePersistedState<SortDirection>(
    'albums-page-direction',
    'desc',
    isDirection,
  )
  const [viewType, setViewType] = usePersistedState<PageViewType>(
    'albums-page-view',
    'grid',
    isViewType,
  )
  const [genre, setGenre] = useUrlParam(AlbumsSearchParams.Genre)
  const [query, setQuery] = useUrlParam(AlbumsSearchParams.Query)
  const [playing, setPlaying] = useState<'play' | 'shuffle' | null>(null)

  // A link sets the sort once, the toolbar takes over from there
  useEffect(() => {
    if (!linkedSort) return

    setSortOption(linkedSort)
    setDirection(naturalDirection(linkedSort))
  }, [linkedSort, setSortOption, setDirection])

  const hideGenres = useAppStore().pages.hideGenresSection
  const genres = useMemo(() => genreOptions(allAlbums ?? []), [allAlbums])
  const selectedGenre = hideGenres ? '' : genre

  const albums = useMemo(() => {
    const search = query.trim().toLowerCase()

    const filtered = (allAlbums ?? []).filter((album) => {
      if (selectedGenre && !matchesGenre(album, selectedGenre)) return false
      if (!search) return true

      return (
        album.name.toLowerCase().includes(search) ||
        (album.artist ?? '').toLowerCase().includes(search)
      )
    })

    return sortAlbums(filtered, sortOption, direction)
  }, [allAlbums, selectedGenre, query, sortOption, direction])

  const columns = albumsColumns()

  function changeSort(option: AlbumSortOption) {
    setSortOption(option)
    setDirection(naturalDirection(option))
  }

  async function loadSongs(list: Albums[], randomOrder: boolean) {
    const order = randomOrder ? shuffle(list) : list
    const songs: ISong[] = []

    for (
      let start = 0;
      start < order.length && songs.length < MAX_QUEUE_SONGS;
      start += CONCURRENT_ALBUM_LOADS
    ) {
      const batch = order.slice(start, start + CONCURRENT_ALBUM_LOADS)
      const loaded = await Promise.all(
        batch.map((album) => getAlbumSongs(album.id)),
      )
      songs.push(...loaded.flatMap((albumSongs) => albumSongs ?? []))
    }

    const queue = randomOrder ? shuffle(songs) : songs
    return queue.slice(0, MAX_QUEUE_SONGS)
  }

  async function playAlbums(randomOrder: boolean) {
    setPlaying(randomOrder ? 'shuffle' : 'play')

    try {
      const songs = await loadSongs(albums, randomOrder)
      if (songs.length === 0) {
        toast.error(t('toast.server.error'))
        return
      }

      setSongList(songs, 0, false, {
        id: 'library-albums',
        name: t('sidebar.albums'),
        type: 'songs',
      })
    } finally {
      setPlaying(null)
    }
  }

  async function playAlbum(album: Albums) {
    const songs = await getAlbumSongs(album.id)
    if (!songs) return

    setSongList(songs, 0, false, {
      id: album.id,
      name: album.name,
      type: 'album',
    })
  }

  if (isLoading) return <AlbumsFallback />
  if (!allAlbums || allAlbums.length === 0) return <EmptyAlbums />

  return (
    <div className="w-full h-full">
      <ShadowHeader>
        <HeaderTitle title={t('sidebar.albums')} count={albums.length} />
      </ShadowHeader>

      <LibraryToolbar>
        <LibraryFilterInput value={query} onChange={setQuery} />

        <div className="flex items-center gap-2 ml-auto">
          {!hideGenres && (
            <LibraryGenreSelect
              genres={genres}
              value={selectedGenre}
              onChange={setGenre}
            />
          )}

          <LibrarySortMenu
            options={albumSortOptions}
            value={sortOption}
            labelKey={(option) => sortOptionLabelKey[option]}
            onChange={changeSort}
          />

          {allowsDirection(sortOption) && (
            <LibraryDirectionButton
              direction={direction}
              onToggle={() =>
                setDirection(direction === 'asc' ? 'desc' : 'asc')
              }
            />
          )}

          <LibraryViewToggle viewType={viewType} onChange={setViewType} />

          <LibraryPlaybackButtons
            disabled={albums.length === 0}
            loading={playing}
            onPlay={() => playAlbums(false)}
            onShuffle={() => playAlbums(true)}
          />
        </div>
      </LibraryToolbar>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <p className="text-sm">{t('album.empty.notFound')}</p>
        </div>
      ) : viewType === 'grid' ? (
        <ListWrapper className="px-0">
          <GridViewWrapper
            list={albums}
            data-testid="albums-grid"
            type="albums"
          >
            {(album) => <AlbumGridCard album={album} />}
          </GridViewWrapper>
        </ListWrapper>
      ) : (
        <ListWrapper>
          <DataTable
            columns={columns}
            data={albums}
            showPagination={true}
            showSearch={false}
            handlePlaySong={(row) => playAlbum(row.original)}
            allowRowSelection={false}
            enableSorting={false}
            dataType="album"
          />
        </ListWrapper>
      )}
    </div>
  )
}
