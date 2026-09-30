import { Albums } from '@/types/responses/album'
import { ISimilarArtist } from '@/types/responses/artist'

// The sort options of the Library screens in the Shelv app, in their order
export type AlbumSortOption =
  | 'name'
  | 'artist'
  | 'mostPlayed'
  | 'recentlyAdded'
  | 'year'

export type ArtistSortOption = 'name' | 'mostPlayed'

export type SortDirection = 'asc' | 'desc'

export const albumSortOptions: AlbumSortOption[] = [
  'name',
  'artist',
  'mostPlayed',
  'recentlyAdded',
  'year',
]

export const artistSortOptions: ArtistSortOption[] = ['name', 'mostPlayed']

export const sortOptionLabelKey: Record<AlbumSortOption, string> = {
  name: 'library.sort.name',
  artist: 'library.sort.artist',
  mostPlayed: 'library.sort.mostPlayed',
  recentlyAdded: 'library.sort.recentlyAdded',
  year: 'library.sort.year',
}

// Names always run from A to Z, the other options have a direction to switch
export function allowsDirection(option: AlbumSortOption) {
  return option !== 'name' && option !== 'artist'
}

export function naturalDirection(option: AlbumSortOption): SortDirection {
  return allowsDirection(option) ? 'desc' : 'asc'
}

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

function compareText(a: string, b: string) {
  return collator.compare(a, b)
}

function compareAlbumNames(a: Albums, b: Albums) {
  return (
    compareText(a.sortName || a.name, b.sortName || b.name) ||
    a.id.localeCompare(b.id)
  )
}

function time(value: string | undefined) {
  return value ? new Date(value).getTime() : 0
}

export function sortAlbums(
  albums: Albums[],
  option: AlbumSortOption,
  direction: SortDirection,
) {
  const factor = direction === 'asc' ? 1 : -1

  return [...albums].sort((a, b) => {
    switch (option) {
      case 'name':
        return compareAlbumNames(a, b)
      case 'artist':
        return (
          compareText(a.artist ?? '', b.artist ?? '') || compareAlbumNames(a, b)
        )
      case 'year':
        return (
          factor * ((a.year ?? 0) - (b.year ?? 0)) || compareAlbumNames(a, b)
        )
      case 'mostPlayed':
        return (
          factor * ((a.playCount ?? 0) - (b.playCount ?? 0)) ||
          compareAlbumNames(a, b)
        )
      case 'recentlyAdded':
        return (
          factor * (time(a.created) - time(b.created)) ||
          compareAlbumNames(a, b)
        )
    }
  })
}

export function sortArtists(
  artists: ISimilarArtist[],
  albums: Albums[],
  option: ArtistSortOption,
  direction: SortDirection,
) {
  if (option === 'name') {
    return [...artists].sort(
      (a, b) => compareText(a.name, b.name) || a.id.localeCompare(b.id),
    )
  }

  // The plays of an artist are the plays of their albums
  const plays = new Map<string, number>()
  for (const album of albums) {
    if (!album.artistId) continue
    plays.set(
      album.artistId,
      (plays.get(album.artistId) ?? 0) + (album.playCount ?? 0),
    )
  }

  const factor = direction === 'asc' ? 1 : -1

  return [...artists].sort(
    (a, b) =>
      factor * ((plays.get(a.id) ?? 0) - (plays.get(b.id) ?? 0)) ||
      compareText(a.name, b.name) ||
      a.id.localeCompare(b.id),
  )
}

export interface GenreOption {
  name: string
  albumCount: number
}

function normalizedGenre(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function genreKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function genreOptions(albums: Albums[]): GenreOption[] {
  const counts = new Map<string, GenreOption>()

  for (const album of albums) {
    const genre = normalizedGenre(album.genre)
    if (!genre) continue

    const key = genreKey(genre)
    const existing = counts.get(key)
    if (existing) existing.albumCount += 1
    else counts.set(key, { name: genre, albumCount: 1 })
  }

  return [...counts.values()].sort((a, b) => compareText(a.name, b.name))
}

export function matchesGenre(album: Albums, selectedGenre: string) {
  const genre = normalizedGenre(album.genre)
  return genre !== undefined && genreKey(genre) === genreKey(selectedGenre)
}
