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

export function getPersistedAlbumSort(): {
  sortOption: AlbumSortOption
  direction: SortDirection
} {
  try {
    const rawOption = localStorage.getItem('album-sort-option')
    const option = rawOption ? JSON.parse(rawOption) : 'recentlyAdded'
    const validOption: AlbumSortOption = isSortOption(option)
      ? option
      : 'recentlyAdded'

    const rawDir = localStorage.getItem('album-sort-direction')
    const dir = rawDir ? JSON.parse(rawDir) : naturalDirection(validOption)
    const validDir: SortDirection = isDirection(dir)
      ? dir
      : naturalDirection(validOption)

    return { sortOption: validOption, direction: validDir }
  } catch {
    return { sortOption: 'recentlyAdded', direction: 'desc' }
  }
}

export function useAlbumSort(
  albums: Albums[] | undefined,
  initialOption: AlbumSortOption = 'recentlyAdded',
) {
  const [sortOption, setSortOption] = usePersistedState<AlbumSortOption>(
    'album-sort-option',
    initialOption,
    isSortOption,
  )
  const [direction, setDirection] = usePersistedState<SortDirection>(
    'album-sort-direction',
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
