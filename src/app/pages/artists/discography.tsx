import { ChevronLeft } from 'lucide-react'
import { useMemo } from 'react'
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
import { LibraryPage } from '@/app/components/library/page'
import {
  LibraryFilterInput,
  LibraryToolbar,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { useGetArtist } from '@/app/hooks/use-artist'
import { useUrlParam } from '@/app/hooks/use-url-param'
import ErrorPage from '@/app/pages/error-page'
import { ROUTES } from '@/routes/routesList'

export default function ArtistDiscography() {
  const { t } = useTranslation()
  const { artistId } = useParams() as { artistId: string }
  const { data: artist, isLoading, isFetched } = useGetArtist(artistId)
  const [query, setQuery] = useUrlParam('query')

  const {
    sortOption,
    direction,
    sortedAlbums,
    changeSortOption,
    toggleDirection,
  } = useAlbumSort(artist?.album)

  const albums = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return sortedAlbums

    return sortedAlbums.filter((album) =>
      album.name.toLowerCase().includes(search),
    )
  }, [sortedAlbums, query])

  if (isLoading) return <AlbumsFallback />
  if (isFetched && !artist) {
    return <ErrorPage status={404} statusText="Not Found" />
  }
  if (!artist) return <AlbumsFallback />

  return (
    <LibraryPage
      header={
        <>
          <ShadowHeader fixed={false} showGlassEffect={false}>
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
                count={albums.length}
              />
            </div>
          </ShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />

            <div className="ml-auto">
              <AlbumSortControls
                sortOption={sortOption}
                direction={direction}
                onSortOptionChange={changeSortOption}
                onToggleDirection={toggleDirection}
              />
            </div>
          </LibraryToolbar>
        </>
      }
    >
      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <p className="text-sm">{t('album.empty.notFound')}</p>
        </div>
      ) : (
        <ListWrapper className="px-0">
          <GridViewWrapper
            list={albums}
            data-testid="artist-discography-grid"
            type="albums"
            defaultWidth={160}
            gap={28}
            titleHeight={72}
          >
            {(album) => <AlbumGridCard album={album} subtitleType="year" />}
          </GridViewWrapper>
        </ListWrapper>
      )}
    </LibraryPage>
  )
}
