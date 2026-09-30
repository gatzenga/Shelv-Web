import { redirect } from 'react-router-dom'
import { ROUTES } from '@/routes/routesList'
import { AlbumListType } from '@/types/responses/album'
import {
  AlbumsFilters,
  AlbumsSearchParams,
  PersistedAlbumListKeys,
} from '@/utils/albumsFilter'

const validMainFilters: string[] = [
  AlbumsFilters.ByArtist,
  AlbumsFilters.ByName,
  AlbumsFilters.RecentlyAdded,
  AlbumsFilters.RecentlyPlayed,
  AlbumsFilters.MostPlayed,
  AlbumsFilters.Starred,
  AlbumsFilters.ByYear,
  AlbumsFilters.Random,
]

export function handleMainFilterRedirection(searchParams: URLSearchParams) {
  const savedFilter = localStorage.getItem(
    PersistedAlbumListKeys.MainFilter,
  ) as AlbumListType | null

  const hasMainFilter = searchParams.has(AlbumsSearchParams.MainFilter)

  if (savedFilter && !validMainFilters.includes(savedFilter)) {
    localStorage.removeItem(PersistedAlbumListKeys.MainFilter)
    if (!hasMainFilter) {
      return redirect(ROUTES.ALBUMS.GENERIC(AlbumsFilters.RecentlyAdded))
    }
    return null
  }

  if (savedFilter && !hasMainFilter) {
    return redirect(ROUTES.ALBUMS.GENERIC(savedFilter))
  }

  return null
}
