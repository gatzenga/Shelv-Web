import { useMemo } from 'react'
import {
  AlbumSortOption,
  albumSortOptions,
  allowsDirection,
  isDirection,
  isSortOption,
  naturalDirection,
  SortDirection,
  sortAlbums,
  sortOptionLabelKey,
} from '@/app/components/library/sorting'
import {
  LibraryDirectionButton,
  LibrarySortMenu,
} from '@/app/components/library/toolbar'
import { usePersistedState } from '@/app/hooks/use-persisted-state'
import { Albums } from '@/types/responses/album'

// The same options as the Library, except the artist: they are all the same here
const artistAlbumSortOptions = albumSortOptions.filter(
  (option) => option !== 'artist',
)

// The newest release by year, the date it was added breaks ties
export function getLatestRelease(albums: Albums[]) {
  return albums.reduce<Albums | undefined>((latest, album) => {
    if (!latest) return album

    const yearDiff = (album.year ?? 0) - (latest.year ?? 0)
    if (yearDiff !== 0) return yearDiff > 0 ? album : latest

    return new Date(album.created).getTime() >
      new Date(latest.created).getTime()
      ? album
      : latest
  }, undefined)
}

// The albums of an artist keep their own sort, separate from the Library's list.
// It is one setting for every artist, on the artist page and on its album list.
const ARTIST_SORT_OPTION_KEY = 'artist-album-sort-option'
const ARTIST_SORT_DIRECTION_KEY = 'artist-album-sort-direction'
const DEFAULT_ARTIST_SORT: AlbumSortOption = 'name'

export function getPersistedAlbumSort(): {
  sortOption: AlbumSortOption
  direction: SortDirection
} {
  try {
    const rawOption = localStorage.getItem(ARTIST_SORT_OPTION_KEY)
    const option = rawOption ? JSON.parse(rawOption) : DEFAULT_ARTIST_SORT
    const validOption: AlbumSortOption = isSortOption(option)
      ? option
      : DEFAULT_ARTIST_SORT

    const rawDir = localStorage.getItem(ARTIST_SORT_DIRECTION_KEY)
    const dir = rawDir ? JSON.parse(rawDir) : naturalDirection(validOption)
    const validDir: SortDirection = isDirection(dir)
      ? dir
      : naturalDirection(validOption)

    return { sortOption: validOption, direction: validDir }
  } catch {
    return {
      sortOption: DEFAULT_ARTIST_SORT,
      direction: naturalDirection(DEFAULT_ARTIST_SORT),
    }
  }
}

export function useAlbumSort(
  albums: Albums[] | undefined,
  initialOption: AlbumSortOption = DEFAULT_ARTIST_SORT,
) {
  const [sortOption, setSortOption] = usePersistedState<AlbumSortOption>(
    ARTIST_SORT_OPTION_KEY,
    initialOption,
    isSortOption,
  )
  const [direction, setDirection] = usePersistedState<SortDirection>(
    ARTIST_SORT_DIRECTION_KEY,
    naturalDirection(sortOption),
    isDirection,
  )

  const sortedAlbums = useMemo(
    () => sortAlbums(albums ?? [], sortOption, direction),
    [albums, sortOption, direction],
  )

  return {
    sortOption,
    direction,
    sortedAlbums,
    changeSortOption: (option: AlbumSortOption) => {
      setSortOption(option)
      setDirection(naturalDirection(option))
    },
    toggleDirection: () => setDirection(direction === 'asc' ? 'desc' : 'asc'),
  }
}

interface AlbumSortControlsProps {
  sortOption: AlbumSortOption
  direction: SortDirection
  onSortOptionChange: (option: AlbumSortOption) => void
  onToggleDirection: () => void
}

export function AlbumSortControls({
  sortOption,
  direction,
  onSortOptionChange,
  onToggleDirection,
}: AlbumSortControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <LibrarySortMenu
        options={artistAlbumSortOptions}
        value={sortOption}
        labelKey={(option) => sortOptionLabelKey[option]}
        onChange={onSortOptionChange}
      />

      {allowsDirection(sortOption) && (
        <LibraryDirectionButton
          direction={direction}
          onToggle={onToggleDirection}
        />
      )}
    </div>
  )
}
