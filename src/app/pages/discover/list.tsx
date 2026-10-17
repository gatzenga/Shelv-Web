import { ChevronLeft, RefreshCwIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { AlbumGridCard } from '@/app/components/albums/album-grid-card'
import { AlbumsFallback } from '@/app/components/fallbacks/album-fallbacks'
import { GridViewWrapper } from '@/app/components/grid-view-wrapper'
import { HeaderTitle } from '@/app/components/header-title'
import { DiceIcon } from '@/app/components/icons/phosphor-icons'
import { LibraryPage } from '@/app/components/library/page'
import {
  LibraryFilterInput,
  LibraryToolbar,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { useGetDiscoverAlbums } from '@/app/hooks/use-home'
import { useUrlParam } from '@/app/hooks/use-url-param'
import ErrorPage from '@/app/pages/error-page'
import { DiscoverList, discoverLists, ROUTES } from '@/routes/routesList'
import { discoverPageSize } from '@/utils/listSizes'

const titles: Record<DiscoverList, string> = {
  'recently-added': 'home.recentlyAdded',
  'recently-played': 'home.recentlyPlayed',
  'frequently-played': 'home.mostPlayed',
  'random-albums': 'home.explore',
}

function isDiscoverList(value: string | undefined): value is DiscoverList {
  return discoverLists.some((list) => list === value)
}

// One list of the Discover page with more albums, in the order of the list:
// no sorting, the filter only hides what does not match
export default function DiscoverListPage() {
  const { list } = useParams()

  if (!isDiscoverList(list)) {
    return <ErrorPage status={404} statusText="Not Found" />
  }

  return <Albums list={list} />
}

function Albums({ list }: { list: DiscoverList }) {
  const { t } = useTranslation()
  const [query, setQuery] = useUrlParam('query')
  const { data, isLoading, isFetching, refetch } = useGetDiscoverAlbums(
    list,
    discoverPageSize,
  )

  const albums = useMemo(() => {
    const search = query.trim().toLowerCase()
    const all = data?.list ?? []
    if (!search) return all

    return all.filter(
      (album) =>
        album.name.toLowerCase().includes(search) ||
        album.artist?.toLowerCase().includes(search),
    )
  }, [data, query])

  if (isLoading) return <AlbumsFallback />

  return (
    <LibraryPage
      header={
        <>
          <ShadowHeader fixed={false} showGlassEffect={false}>
            <div className="flex items-center gap-2">
              <Link
                to={ROUTES.LIBRARY.HOME}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <HeaderTitle title={t(titles[list])} />
            </div>
          </ShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />

            {list === 'random-albums' && (
              <button
                type="button"
                className="ml-auto flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
                disabled={isFetching}
                onClick={() => refetch()}
                data-testid="discover-refresh-button"
              >
                {isFetching ? (
                  <RefreshCwIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <DiceIcon className="h-5 w-5" />
                )}
                <span className="sr-only">Refresh</span>
              </button>
            )}
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
            data-testid="discover-grid"
            type="albums"
            defaultWidth={160}
            gap={28}
            titleHeight={72}
          >
            {(album) => <AlbumGridCard album={album} subtitleType="artist" />}
          </GridViewWrapper>
        </ListWrapper>
      )}
    </LibraryPage>
  )
}
