import { redirect } from 'react-router-dom'
import { ROUTES } from '@/routes/routesList'
import {
  AlbumsFilters,
  AlbumsSearchParams,
  PersistedAlbumListKeys,
} from '@/utils/albumsFilter'

export function handleDiscographyRedirection(searchParams: URLSearchParams) {
  const filter = searchParams.get(AlbumsSearchParams.MainFilter)
  const artistId = searchParams.get(AlbumsSearchParams.ArtistId)

  if (filter === AlbumsFilters.ByDiscography && artistId) {
    return redirect(ROUTES.ARTIST.DISCOGRAPHY(artistId))
  }

  // Artist discography is artist-specific and should not be saved as the global main albums filter,
  // nor should navigating to /library/albums redirect back to an artist's discography.
  if (
    localStorage.getItem(PersistedAlbumListKeys.MainFilter) ===
    AlbumsFilters.ByDiscography
  ) {
    localStorage.removeItem(PersistedAlbumListKeys.MainFilter)
  }
  localStorage.removeItem(PersistedAlbumListKeys.ArtistNameFilter)
  localStorage.removeItem(PersistedAlbumListKeys.ArtistIdFilter)

  return null
}
