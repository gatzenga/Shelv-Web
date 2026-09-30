import { ArrowDown, ArrowUp, ChevronLeft, ListFilter } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { AlbumGridCard } from '@/app/components/albums/album-grid-card'
import { AlbumsFallback } from '@/app/components/fallbacks/album-fallbacks'
import { GridViewWrapper } from '@/app/components/grid-view-wrapper'
import { HeaderTitle } from '@/app/components/header-title'
import ListWrapper from '@/app/components/list-wrapper'
import { ExpandableField } from '@/app/components/search/expandable-field'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { useGetArtist } from '@/app/hooks/use-artist'
import ErrorPage from '@/app/pages/error-page'
import { ROUTES } from '@/routes/routesList'
import { Albums } from '@/types/responses/album'

type DiscographyFilterKey =
  | 'most-played'
  | 'name'
  | 'recent-added'
  | 'recent-played'
  | 'release-year'

const filterItems: { key: DiscographyFilterKey; labelKey: string }[] = [
  { key: 'most-played', labelKey: 'album.list.filter.mostPlayed' },
  { key: 'name', labelKey: 'album.list.filter.name' },
  { key: 'recent-added', labelKey: 'album.list.filter.recentlyAdded' },
  { key: 'recent-played', labelKey: 'album.list.filter.recentlyPlayed' },
  { key: 'release-year', labelKey: 'album.list.filter.releaseYear' },
]

export default function ArtistDiscography() {
  const { t } = useTranslation()
  const { artistId } = useParams() as { artistId: string }
  const { data: artist, isLoading, isFetched } = useGetArtist(artistId)

  const [currentFilter, setCurrentFilter] =
    useState<DiscographyFilterKey>('release-year')
  const [isAscending, setIsAscending] = useState(false)

  const [searchActive, setSearchActive] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const currentFilterItem =
    filterItems.find((item) => item.key === currentFilter) ?? filterItems[0]

  function handleFilterChange(key: DiscographyFilterKey) {
    setCurrentFilter(key)
    setIsAscending(key === 'name')
  }

  function handleToggleSearch() {
    if (searchActive) {
      setSearchActive(false)
      setSearch('')
      if (inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.blur()
      }
    } else {
      setSearchActive(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const sortedAndFilteredAlbums = useMemo(() => {
    if (!artist?.album) return []

    let albums = [...artist.album]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      albums = albums.filter((a) => a.name.toLowerCase().includes(q))
    }

    albums.sort((a: Albums, b: Albums) => {
      let result = 0
      switch (currentFilter) {
        case 'most-played':
          result = (b.playCount ?? 0) - (a.playCount ?? 0)
          break
        case 'name':
          result = a.name.localeCompare(b.name)
          break
        case 'recent-added':
          result = new Date(b.created).getTime() - new Date(a.created).getTime()
          break
        case 'recent-played': {
          const aTime = a.played ? new Date(a.played).getTime() : 0
          const bTime = b.played ? new Date(b.played).getTime() : 0
          result = bTime - aTime
          break
        }
        case 'release-year':
          result = (b.year ?? 0) - (a.year ?? 0)
          break
      }

      if (currentFilter === 'name') {
        return isAscending ? result : -result
      }
      return isAscending ? -result : result
    })

    return albums
  }, [artist?.album, search, currentFilter, isAscending])

  if (isLoading) return <AlbumsFallback />
  if (isFetched && !artist) {
    return <ErrorPage status={404} statusText="Not Found" />
  }
  if (!artist) return <AlbumsFallback />

  return (
    <div className="w-full h-full">
      <ShadowHeader>
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.ARTIST.PAGE(artist.id)}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={artist.name}
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <HeaderTitle
              title={t('album.list.header.albumsByArtist', {
                artist: artist.name,
              })}
              count={sortedAndFilteredAlbums.length}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Direction Toggle Button */}
            <SimpleTooltip
              text={t(isAscending ? 'table.sort.asc' : 'table.sort.desc')}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAscending((prev) => !prev)}
              >
                {isAscending ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </Button>
            </SimpleTooltip>

            {/* Sort Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ListFilter className="w-4 h-4 mr-2" />
                  {t(currentFilterItem.labelKey)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {filterItems.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.key}
                    checked={item.key === currentFilter}
                    onCheckedChange={() => handleFilterChange(item.key)}
                    className="cursor-pointer"
                  >
                    {t(item.labelKey)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Expandable Search Button */}
            <ExpandableField
              active={searchActive}
              inputRef={inputRef}
              onToggle={handleToggleSearch}
              placeholder={t('album.list.search.placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </ShadowHeader>

      <ListWrapper className="px-0">
        {sortedAndFilteredAlbums.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <p className="text-sm">{t('album.empty.notFound')}</p>
          </div>
        ) : (
          <GridViewWrapper
            list={sortedAndFilteredAlbums}
            data-testid="artist-discography-grid"
            type="albums"
          >
            {(album) => <AlbumGridCard album={album} subtitleType="year" />}
          </GridViewWrapper>
        )}
      </ListWrapper>
    </div>
  )
}
