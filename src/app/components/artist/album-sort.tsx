import { useMemo, useState } from 'react'
import {
  AlbumSortOption,
  albumSortOptions,
  allowsDirection,
  naturalDirection,
  SortDirection,
  sortAlbums,
  sortOptionLabelKey,
} from '@/app/components/library/sorting'
import {
  LibraryDirectionButton,
  LibrarySortMenu,
} from '@/app/components/library/toolbar'
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

export function useAlbumSort(
  albums: Albums[] | undefined,
  initialOption: AlbumSortOption = 'recentlyAdded',
) {
  const [sortOption, setSortOption] = useState(initialOption)
  const [direction, setDirection] = useState<SortDirection>(
    naturalDirection(initialOption),
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
    toggleDirection: () =>
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc')),
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
