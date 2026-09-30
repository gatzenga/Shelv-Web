export enum AlbumsSearchParams {
  MainFilter = 'filter',
  YearFilter = 'yearFilter',
  Genre = 'genre',
  Query = 'query',
  Order = 'order',
}

export enum YearSortOptions {
  Oldest = 'oldest',
  Newest = 'newest',
}

export type YearFilter = `${YearSortOptions}`

export enum AlbumsFilters {
  ByArtist = 'alphabeticalByArtist',
  ByGenre = 'byGenre',
  Starred = 'starred',
  MostPlayed = 'frequent',
  ByName = 'alphabeticalByName',
  Random = 'random',
  RecentlyAdded = 'newest',
  RecentlyPlayed = 'recent',
  ByYear = 'byYear',
  ByDiscography = 'artistDiscography',
  Search = 'search',
}
