import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/app/components/ui/button'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { AlbumListType } from '@/types/responses/album'
import {
  AlbumsFilters,
  AlbumsSearchParams,
  naturalOrder,
  SortOptions,
  YearFilter,
  YearSortOptions,
} from '@/utils/albumsFilter'
import { scrollPageToTop } from '@/utils/scrollPageToTop'
import { SearchParamsHandler } from '@/utils/searchParamsHandler'

// Ascending / descending for the current album list. By year keeps its own
// parameter, which is also used by the year links on album pages.
export function AlbumsSortDirection() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getSearchParam } = new SearchParamsHandler(searchParams)

  const currentFilter = getSearchParam<AlbumListType>(
    AlbumsSearchParams.MainFilter,
    AlbumsFilters.RecentlyAdded,
  )
  const isByYear = currentFilter === AlbumsFilters.ByYear
  const yearFilter = getSearchParam<YearFilter>(
    AlbumsSearchParams.YearFilter,
    YearSortOptions.Oldest,
  )
  const order = getSearchParam<SortOptions>(
    AlbumsSearchParams.Order,
    naturalOrder(currentFilter),
  )

  const isAscending = isByYear
    ? yearFilter === YearSortOptions.Oldest
    : order === SortOptions.Asc

  function handleToggle() {
    setSearchParams((state) => {
      if (isByYear) {
        state.set(
          AlbumsSearchParams.YearFilter,
          isAscending ? YearSortOptions.Newest : YearSortOptions.Oldest,
        )
      } else {
        state.set(
          AlbumsSearchParams.Order,
          isAscending ? SortOptions.Desc : SortOptions.Asc,
        )
      }

      return state
    })
    scrollPageToTop()
  }

  return (
    <SimpleTooltip text={t(isAscending ? 'table.sort.asc' : 'table.sort.desc')}>
      <Button variant="outline" size="sm" onClick={handleToggle}>
        {isAscending ? (
          <ArrowUp className="w-4 h-4" />
        ) : (
          <ArrowDown className="w-4 h-4" />
        )}
      </Button>
    </SimpleTooltip>
  )
}
