import { ArrowDown, ArrowUp, ListFilter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ExpandableField } from '@/app/components/search/expandable-field'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { ISimilarArtist } from '@/types/responses/artist'
import { SortOptions } from '@/utils/albumsFilter'

export enum ArtistsSortBy {
  Name = 'name',
  AlbumCount = 'albumCount',
}

enum ArtistsSearchParams {
  SortBy = 'sort',
  Order = 'order',
  Query = 'query',
}

const sortLabels: Record<ArtistsSortBy, string> = {
  [ArtistsSortBy.Name]: 'table.columns.name',
  [ArtistsSortBy.AlbumCount]: 'table.columns.albumCount',
}

// Sort and search of the artists page live in the URL, so they survive
// opening an artist and going back
export function useArtistsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const sortBy =
    (searchParams.get(ArtistsSearchParams.SortBy) as ArtistsSortBy | null) ??
    ArtistsSortBy.Name
  const order =
    (searchParams.get(ArtistsSearchParams.Order) as SortOptions | null) ??
    SortOptions.Asc
  const query = searchParams.get(ArtistsSearchParams.Query) ?? ''

  function update(name: ArtistsSearchParams, value: string) {
    setSearchParams(
      (state) => {
        if (value) state.set(name, value)
        else state.delete(name)
        return state
      },
      { replace: true },
    )
  }

  return {
    sortBy,
    order,
    query,
    setSortBy: (value: ArtistsSortBy) =>
      update(ArtistsSearchParams.SortBy, value),
    setOrder: (value: SortOptions) => update(ArtistsSearchParams.Order, value),
    setQuery: (value: string) => update(ArtistsSearchParams.Query, value),
  }
}

export function filterAndSortArtists(
  artists: ISimilarArtist[],
  {
    sortBy,
    order,
    query,
  }: { sortBy: ArtistsSortBy; order: SortOptions; query: string },
) {
  const search = query.trim().toLowerCase()
  const filtered = search
    ? artists.filter((artist) => artist.name.toLowerCase().includes(search))
    : artists

  const sorted = [...filtered].sort((a, b) =>
    sortBy === ArtistsSortBy.AlbumCount
      ? (a.albumCount ?? 0) - (b.albumCount ?? 0) ||
        a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name),
  )

  return order === SortOptions.Desc ? sorted.reverse() : sorted
}

export function ArtistsFilters({
  filters,
}: {
  filters: ReturnType<typeof useArtistsFilters>
}) {
  const { t } = useTranslation()
  const { sortBy, order, query, setSortBy, setOrder, setQuery } = filters
  const isAscending = order === SortOptions.Asc

  return (
    <div className="flex gap-2 items-center">
      <SimpleTooltip
        text={t(isAscending ? 'table.sort.asc' : 'table.sort.desc')}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setOrder(isAscending ? SortOptions.Desc : SortOptions.Asc)
          }
        >
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
            {t(sortLabels[sortBy])}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.values(ArtistsSortBy).map((value) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={value === sortBy}
              onCheckedChange={() => setSortBy(value)}
              className="cursor-pointer"
            >
              {t(sortLabels[value])}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ArtistsSearch query={query} setQuery={setQuery} />
    </div>
  )
}

function ArtistsSearch({
  query,
  setQuery,
}: {
  query: string
  setQuery: (value: string) => void
}) {
  const { t } = useTranslation()
  const [active, setActive] = useState(query !== '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== query) {
      inputRef.current.value = query
    }
  }, [query])

  function handleToggle() {
    if (active) {
      setActive(false)
      setQuery('')
      inputRef.current?.blur()
    } else {
      setActive(true)
      inputRef.current?.focus()
    }
  }

  return (
    <ExpandableField
      active={active}
      inputRef={inputRef}
      onToggle={handleToggle}
      defaultValue={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={t('artist.search.placeholder')}
    />
  )
}
