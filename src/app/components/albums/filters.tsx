import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ExpandableSearchInput } from '@/app/components/search/expandable-input'
import { AlbumListType } from '@/types/responses/album'
import { AlbumsFilters, AlbumsSearchParams } from '@/utils/albumsFilter'
import { SearchParamsHandler } from '@/utils/searchParamsHandler'
import { AlbumsFilterByGenre } from './filters/by-genre'
import { AlbumsMainFilter } from './filters/main'
import { AlbumsSortDirection } from './filters/sort-direction'

// search results and a discography have no sort order to switch
const unsortableFilters: string[] = [
  AlbumsFilters.Search,
  AlbumsFilters.ByDiscography,
  AlbumsFilters.Random,
]

export function AlbumsFilter() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { getSearchParam } = new SearchParamsHandler(searchParams)

  const currentFilter = getSearchParam<AlbumListType>(
    AlbumsSearchParams.MainFilter,
    AlbumsFilters.RecentlyAdded,
  )

  return (
    <div className="flex gap-2 flex-1 justify-end">
      {!unsortableFilters.includes(currentFilter) && <AlbumsSortDirection />}

      {currentFilter === AlbumsFilters.ByGenre && <AlbumsFilterByGenre />}

      <AlbumsMainFilter />

      <ExpandableSearchInput placeholder={t('album.list.search.placeholder')} />
    </div>
  )
}
