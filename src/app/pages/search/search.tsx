import { useQuery } from '@tanstack/react-query'
import { HistoryIcon, Loader2Icon, SearchIcon, XCircleIcon } from 'lucide-react'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { LibraryPage } from '@/app/components/library/page'
import ListWrapper from '@/app/components/list-wrapper'
import {
  SearchAlbumRow,
  SearchArtistRow,
} from '@/app/components/search/result-rows'
import { SongListRow } from '@/app/components/song/list-row'
import { Input } from '@/app/components/ui/input'
import { useFavorites } from '@/app/hooks/use-favorites'
import { subsonic } from '@/service/subsonic'
import { useAppStore } from '@/store/app.store'
import { usePlayerActions } from '@/store/player.store'
import { convertMinutesToMs } from '@/utils/convertSecondsToTime'
import { queryKeys } from '@/utils/queryKeys'
import {
  clearSearchHistory,
  getSearchHistory,
  recordSearch,
  recordSearchAutomatically,
} from '@/utils/searchHistory'

export default function Search() {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()
  const hideFavorites = useAppStore().pages.hideFavoritesSection

  const [query, setQuery] = useState('')
  const [history, setHistory] = useState(getSearchHistory)
  const [debounced] = useDebounce(query.trim(), 300)
  const inputRef = useRef<HTMLInputElement>(null)
  // what the last finished search recorded, replaced by the next one
  const provisional = useRef<string | null>(null)

  const term = query.trim()

  const { data, isFetching, isError } = useQuery({
    queryKey: [queryKeys.search, debounced],
    queryFn: () => subsonic.search.get({ query: debounced }),
    enabled: debounced.length > 0,
    staleTime: convertMinutesToMs(5),
  })
  const { data: favorites } = useFavorites()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // A finished search goes into the history, the letters typed on the way
  // replace each other
  useEffect(() => {
    if (!data || isFetching || !debounced || debounced !== term) return

    const update = recordSearchAutomatically(debounced, provisional.current)
    provisional.current = update.provisional
    setHistory(update.entries)
  }, [data, isFetching, debounced, term])

  useEffect(() => {
    if (!term) provisional.current = null
  }, [term])

  const isCurrent = debounced === term && term.length > 0

  const artists = useMemo(
    () =>
      isCurrent
        ? (data?.artist ?? []).filter((artist) => (artist.albumCount ?? 1) > 0)
        : [],
    [data?.artist, isCurrent],
  )
  const albums = isCurrent ? (data?.album ?? []) : []
  const songs = isCurrent ? (data?.song ?? []) : []

  const needle = term.toLowerCase()
  const includes = (...values: (string | undefined)[]) =>
    values.some((value) => value?.toLowerCase().includes(needle) === true)

  const favoriteSongs =
    hideFavorites || !needle
      ? []
      : (favorites?.songs ?? []).filter((song) =>
          includes(song.title, song.artist, song.album),
        )
  const favoriteAlbums =
    hideFavorites || !needle
      ? []
      : (favorites?.albums ?? []).filter((album) =>
          includes(album.name, album.artist),
        )
  const favoriteArtists =
    hideFavorites || !needle
      ? []
      : (favorites?.artists ?? []).filter((artist) => includes(artist.name))

  const hasFavoriteResults =
    favoriteSongs.length + favoriteAlbums.length + favoriteArtists.length > 0
  const hasResults =
    artists.length + albums.length + songs.length > 0 || hasFavoriteResults
  const isSearching =
    term.length > 0 && !hasResults && (!isCurrent || isFetching)

  // The user opened a result: the search is kept like a chosen one
  function commit() {
    if (!term) return

    setHistory(recordSearch(term))
    provisional.current = null
  }

  function pickHistoryEntry(entry: string) {
    setHistory(recordSearch(entry))
    provisional.current = null
    setQuery(entry)
    inputRef.current?.focus()
  }

  function clearHistory() {
    setHistory(clearSearchHistory())
    provisional.current = null
  }

  function playSongs(list: typeof songs, index: number) {
    commit()
    setSongList(list, index, false, {
      type: 'songs',
      id: 'search',
      name: t('sidebar.search'),
    })
  }

  function renderBody() {
    if (isSearching) {
      return (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="text-sm">{t('search.searching')}</span>
        </div>
      )
    }

    if (!term && history.length > 0) {
      return (
        <div className="flex flex-col" data-testid="search-history">
          <div className="flex items-center justify-between px-8 py-2.5 border-b">
            <h3 className="font-semibold">{t('search.recent')}</h3>
            <button
              type="button"
              onClick={clearHistory}
              aria-label={t('search.clearHistory')}
              className="text-sm text-primary hover:underline"
            >
              {t('search.clear')}
            </button>
          </div>

          {history.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => pickHistoryEntry(entry)}
              className="flex items-center gap-3 px-8 py-3 text-left hover:bg-foreground/10 transition-colors"
            >
              <HistoryIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate border-b border-transparent">
                {entry}
              </span>
            </button>
          ))}
        </div>
      )
    }

    if (!hasResults) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <SearchIcon className="size-12 opacity-40" />
          <p className="text-sm">
            {term
              ? isError
                ? t('search.failed')
                : t('command.noResults')
              : t('search.enterTerm')}
          </p>
        </div>
      )
    }

    return (
      <ListWrapper className="flex flex-col gap-7">
        {artists.length > 0 && (
          <Section title={t('sidebar.artists')}>
            {artists.map((artist) => (
              <SearchArtistRow
                key={artist.id}
                artist={artist}
                onOpen={commit}
              />
            ))}
          </Section>
        )}

        {albums.length > 0 && (
          <Section title={t('sidebar.albums')}>
            {albums.map((album) => (
              <SearchAlbumRow key={album.id} album={album} onOpen={commit} />
            ))}
          </Section>
        )}

        {songs.length > 0 && (
          <Section title={t('sidebar.songs')}>
            {songs.map((song, index) => (
              <SongListRow
                key={song.id}
                song={song}
                index={index}
                onPlay={() => playSongs(songs, index)}
              />
            ))}
          </Section>
        )}

        {hasFavoriteResults && (
          <Section title={t('sidebar.favorites')}>
            {favoriteSongs.map((song, index) => (
              <SongListRow
                key={`favorite-song-${song.id}`}
                song={song}
                index={index}
                onPlay={() => playSongs(favoriteSongs, index)}
              />
            ))}
            {favoriteArtists.map((artist) => (
              <SearchArtistRow
                key={`favorite-artist-${artist.id}`}
                artist={artist}
                onOpen={commit}
              />
            ))}
            {favoriteAlbums.map((album) => (
              <SearchAlbumRow
                key={`favorite-album-${album.id}`}
                album={album}
                onOpen={commit}
              />
            ))}
          </Section>
        )}
      </ListWrapper>
    )
  }

  return (
    <LibraryPage
      header={
        <div className="border-b px-8 py-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
              }}
              placeholder={t('search.placeholder')}
              autoCorrect="false"
              autoCapitalize="false"
              spellCheck="false"
              className="h-11 pl-9 pr-9"
              data-testid="search-input"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t('search.clear')}
              >
                <XCircleIcon className="size-4" />
              </button>
            )}
          </div>
        </div>
      }
    >
      {renderBody()}
    </LibraryPage>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  )
}
