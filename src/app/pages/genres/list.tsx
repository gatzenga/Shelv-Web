import { useQuery } from '@tanstack/react-query'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { SongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { HeaderTitle } from '@/app/components/header-title'
import { LibraryPage } from '@/app/components/library/page'
import {
  LibraryFilterInput,
  LibraryToolbar,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { DataTable } from '@/app/components/ui/data-table'
import { useUrlParam } from '@/app/hooks/use-url-param'
import { genresColumns } from '@/app/tables/genres-columns'
import { ROUTES } from '@/routes/routesList'
import { subsonic } from '@/service/subsonic'
import { queryKeys } from '@/utils/queryKeys'

const MemoShadowHeader = memo(ShadowHeader)
const MemoHeaderTitle = memo(HeaderTitle)
const MemoDataTable = memo(DataTable) as typeof DataTable

export default function GenresList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const columns = genresColumns()
  const [query, setQuery] = useUrlParam('query')

  const { data: genres, isLoading } = useQuery({
    queryKey: [queryKeys.genre.all],
    queryFn: subsonic.genres.get,
  })

  const filteredGenres = useMemo(() => {
    const search = query.trim().toLowerCase()

    return (genres ?? [])
      .filter((genre) => genre.albumCount >= 2)
      .filter((genre) => !search || genre.value.toLowerCase().includes(search))
      .sort((a, b) => b.songCount - a.songCount)
  }, [genres, query])

  if (isLoading) return <SongListFallback />
  if (!genres) return null

  return (
    <LibraryPage
      header={
        <>
          <MemoShadowHeader fixed={false} showGlassEffect={false}>
            <MemoHeaderTitle
              title={t('sidebar.genres')}
              count={filteredGenres.length}
            />
          </MemoShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />
          </LibraryToolbar>
        </>
      }
    >
      <ListWrapper>
        <MemoDataTable
          columns={columns}
          data={filteredGenres}
          showPagination={true}
          showSearch={false}
          allowRowSelection={false}
          dataType="genre"
          onRowClick={(row) => navigate(ROUTES.GENRE.PAGE(row.original.value))}
        />
      </ListWrapper>
    </LibraryPage>
  )
}
