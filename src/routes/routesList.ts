import { AlbumListType } from '@/types/responses/album'
import { AlbumsFilters, YearFilter } from '@/utils/albumsFilter'

const LIBRARY = {
  HOME: '/',
  ARTISTS: '/library/artists',
  ALBUMS: '/library/albums',
  FAVORITES: '/library/favorites',
  PLAYLISTS: '/library/playlists',
  RADIOS: '/library/radios',
  GENRES: '/library/genres',
  SEARCH: '/library/search',
}

const ARTIST = {
  PAGE: (artistId: string) => `${LIBRARY.ARTISTS}/${artistId}`,
  PATH: `${LIBRARY.ARTISTS}/:artistId`,
  DISCOGRAPHY: (artistId: string) =>
    `${LIBRARY.ARTISTS}/${artistId}/discography`,
  DISCOGRAPHY_PATH: `${LIBRARY.ARTISTS}/:artistId/discography`,
}

const ALBUM = {
  PAGE: (albumId: string) => `${LIBRARY.ALBUMS}/${albumId}`,
  PATH: `${LIBRARY.ALBUMS}/:albumId`,
}

const ALBUMS = {
  GENRE: (genre: string) =>
    `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.ByGenre}&genre=${encodeURIComponent(genre)}`,
  ARTIST: (id: string, _name?: string) =>
    `${LIBRARY.ARTISTS}/${id}/discography`,
  RECENTLY_PLAYED: `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.RecentlyPlayed}`,
  MOST_PLAYED: `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.MostPlayed}`,
  RECENTLY_ADDED: `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.RecentlyAdded}`,
  RANDOM: `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.Random}`,
  SEARCH: (query: string) =>
    `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.Search}&query=${encodeURIComponent(query)}`,
  YEAR: (yearFilter: YearFilter) =>
    `${LIBRARY.ALBUMS}?filter=${AlbumsFilters.ByYear}&yearFilter=${yearFilter}`,
  GENERIC: (filter: AlbumListType) => `${LIBRARY.ALBUMS}?filter=${filter}`,
}

const FAVORITES = {
  PAGE: LIBRARY.FAVORITES,
  SCOPE: (scope: 'songs' | 'albums' | 'artists') =>
    `${LIBRARY.FAVORITES}?scope=${scope}`,
}

const PLAYLIST = {
  PAGE: (playlistId: string) => `${LIBRARY.PLAYLISTS}/${playlistId}`,
  PATH: `${LIBRARY.PLAYLISTS}/:playlistId`,
}

const GENRE = {
  PAGE: (genreName: string) =>
    `${LIBRARY.GENRES}/${encodeURIComponent(genreName)}`,
  PATH: `${LIBRARY.GENRES}/:genreName`,
}

const SERVER_CONFIG = '/server-config'

export const ROUTES = {
  LIBRARY,
  ARTIST,
  ALBUM,
  ALBUMS,
  FAVORITES,
  PLAYLIST,
  GENRE,
  SERVER_CONFIG,
}
