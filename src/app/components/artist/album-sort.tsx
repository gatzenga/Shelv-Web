import { ArrowDown, ArrowUp, ListFilter } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { Albums } from '@/types/responses/album'

export type AlbumSortKey =
  | 'most-played'
  | 'name'
  | 'recent-added'
  | 'recent-played'
  | 'release-year'

const sortItems: { key: AlbumSortKey; labelKey: string }[] = [
  { key: 'most-played', labelKey: 'album.list.filter.mostPlayed' },
  { key: 'name', labelKey: 'album.list.filter.name' },
  { key: 'recent-added', labelKey: 'album.list.filter.recentlyAdded' },
  { key: 'recent-played', labelKey: 'album.list.filter.recentlyPlayed' },
  { key: 'release-year', labelKey: 'album.list.filter.releaseYear' },
]

function compareAlbums(a: Albums, b: Albums, key: AlbumSortKey) {
  switch (key) {
    case 'most-played':
      return (b.playCount ?? 0) - (a.playCount ?? 0)
    case 'name':
      return a.name.localeCompare(b.name)
    case 'recent-added':
      return new Date(b.created).getTime() - new Date(a.created).getTime()
    case 'recent-played': {
      const aTime = a.played ? new Date(a.played).getTime() : 0
      const bTime = b.played ? new Date(b.played).getTime() : 0
      return bTime - aTime
    }
    case 'release-year':
      return (b.year ?? 0) - (a.year ?? 0)
  }
}

export function sortAlbums(
  albums: Albums[],
  key: AlbumSortKey,
  isAscending: boolean,
) {
  return [...albums].sort((a, b) => {
    const result = compareAlbums(a, b, key)

    // Names read naturally A to Z, everything else is ranked high to low
    if (key === 'name') return isAscending ? result : -result
    return isAscending ? -result : result
  })
}

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
  initialKey: AlbumSortKey = 'release-year',
) {
  const [sortKey, setSortKey] = useState<AlbumSortKey>(initialKey)
  const [isAscending, setIsAscending] = useState(initialKey === 'name')

  const sortedAlbums = useMemo(
    () => sortAlbums(albums ?? [], sortKey, isAscending),
    [albums, sortKey, isAscending],
  )

  function changeSortKey(key: AlbumSortKey) {
    setSortKey(key)
    setIsAscending(key === 'name')
  }

  return {
    sortKey,
    isAscending,
    sortedAlbums,
    changeSortKey,
    toggleDirection: () => setIsAscending((prev) => !prev),
  }
}

interface AlbumSortControlsProps {
  sortKey: AlbumSortKey
  isAscending: boolean
  onSortKeyChange: (key: AlbumSortKey) => void
  onToggleDirection: () => void
}

export function AlbumSortControls({
  sortKey,
  isAscending,
  onSortKeyChange,
  onToggleDirection,
}: AlbumSortControlsProps) {
  const { t } = useTranslation()
  const currentItem = sortItems.find((item) => item.key === sortKey)

  return (
    <div className="flex items-center gap-2">
      <SimpleTooltip
        text={t(isAscending ? 'table.sort.asc' : 'table.sort.desc')}
      >
        <Button variant="outline" size="sm" onClick={onToggleDirection}>
          {isAscending ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
        </Button>
      </SimpleTooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ListFilter className="w-4 h-4 mr-2" />
            {t(currentItem?.labelKey ?? sortItems[0].labelKey)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {sortItems.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.key}
              checked={item.key === sortKey}
              onCheckedChange={() => onSortKeyChange(item.key)}
              className="cursor-pointer"
            >
              {t(item.labelKey)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
