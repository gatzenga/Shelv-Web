import { ChevronLeft } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { AlbumGridCard } from '@/app/components/albums/album-grid-card'
import {
  AlbumSortControls,
  useAlbumSort,
} from '@/app/components/artist/album-sort'
import { AlbumsFallback } from '@/app/components/fallbacks/album-fallbacks'
import { GridViewWrapper } from '@/app/components/grid-view-wrapper'
import { HeaderTitle } from '@/app/components/header-title'
import ListWrapper from '@/app/components/list-wrapper'
import { ExpandableField } from '@/app/components/search/expandable-field'
import { useGetArtist } from '@/app/hooks/use-artist'
import ErrorPage from '@/app/pages/error-page'
import { ROUTES } from '@/routes/routesList'

export default function ArtistDiscography() {
  const { t } = useTranslation()
  const { artistId } = useParams() as { artistId: string }
  const { data: artist, isLoading, isFetched } = useGetArtist(artistId)

  const {
    sortOption,
    direction,
    sortedAlbums,
    changeSortOption,
    toggleDirection,
  } = useAlbumSort(artist?.album)

  const [searchActive, setSearchActive] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

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
    const q = search.trim().toLowerCase()
    if (!q) return sortedAlbums

    return sortedAlbums.filter((a) => a.name.toLowerCase().includes(q))
  }, [sortedAlbums, search])

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
            <AlbumSortControls
              sortOption={sortOption}
              direction={direction}
              onSortOptionChange={changeSortOption}
              onToggleDirection={toggleDirection}
            />

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
