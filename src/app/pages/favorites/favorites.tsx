import { ChevronLeft, HeartIcon } from 'lucide-react'
import { ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { AlbumGridCard } from '@/app/components/albums/album-grid-card'
import { ArtistGridCard } from '@/app/components/artist/artist-grid-card'
import { InfinitySongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { FavoriteSongRow } from '@/app/components/favorites/song-row'
import { HeaderTitle } from '@/app/components/header-title'
import { LibraryPage } from '@/app/components/library/page'
import {
  LibraryFilterInput,
  LibraryPlaybackButtons,
  LibraryToolbar,
} from '@/app/components/library/toolbar'
import ListWrapper from '@/app/components/list-wrapper'
import { useFavorites } from '@/app/hooks/use-favorites'
import { useSongList } from '@/app/hooks/use-song-list'
import { useUrlParam } from '@/app/hooks/use-url-param'
import { ROUTES } from '@/routes/routesList'
import { usePlayerActions } from '@/store/player.store'
import { buildLibraryQueue } from '@/utils/libraryPlayback'

// The overview shows this many of each, like the Shelv app
const PREVIEW_LIMIT = 5

type Scope = 'songs' | 'albums' | 'artists'

const scopes: Scope[] = ['songs', 'albums', 'artists']

const scopeTitleKey: Record<Scope, string> = {
  songs: 'favorites.favoriteSongs',
  albums: 'favorites.favoriteAlbums',
  artists: 'favorites.favoriteArtists',
}

const albumGridClass =
  'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4'
const artistGridClass =
  'grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4'

export default function Favorites() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { getAlbumSongs } = useSongList()
  const { setSongList } = usePlayerActions()
  const { data, isLoading } = useFavorites()
  const [query, setQuery] = useUrlParam('query')
  const [shuffling, setShuffling] = useState(false)

  const requestedScope = searchParams.get('scope') as Scope | null
  const scope =
    requestedScope && scopes.includes(requestedScope) ? requestedScope : null

  // The filter only exists on the overview, the pages of a single kind show all
  const search = scope ? '' : query.trim().toLowerCase()

  const songs = useMemo(
    () =>
      (data?.songs ?? []).filter((song) =>
        matches(search, song.title, song.artist, song.album),
      ),
    [data?.songs, search],
  )
  const albums = useMemo(
    () =>
      (data?.albums ?? []).filter((album) =>
        matches(search, album.name, album.artist),
      ),
    [data?.albums, search],
  )
  const artists = useMemo(
    () =>
      (data?.artists ?? []).filter((artist) => matches(search, artist.name)),
    [data?.artists, search],
  )

  function playSongs(index: number) {
    setSongList(songs, index, false, {
      type: 'favourite',
      id: 'favourite',
      name: t('sidebar.favorites'),
    })
  }

  // Shuffle only: favorites have no order of their own, and playing them
  // straight through would alternate a single song with a whole album
  async function shuffleFavorites() {
    setShuffling(true)

    try {
      const queue = await buildLibraryQueue({
        albums,
        songs,
        shuffle: true,
        loadAlbumSongs: getAlbumSongs,
      })
      if (queue.length === 0) {
        toast.error(t('toast.server.error'))
        return
      }

      setSongList(queue, 0, false, {
        type: 'favourite',
        id: 'favourite',
        name: t('sidebar.favorites'),
      })
    } finally {
      setShuffling(false)
    }
  }

  if (isLoading) return <InfinitySongListFallback />

  const isEmpty =
    songs.length === 0 && albums.length === 0 && artists.length === 0

  function renderScope(current: Scope) {
    if (current === 'songs') {
      return (
        <div className="flex flex-col">
          {songs.map((song, index) => (
            <FavoriteSongRow
              key={song.id}
              song={song}
              index={index}
              onPlay={() => playSongs(index)}
            />
          ))}
        </div>
      )
    }

    if (current === 'albums') {
      return (
        <div className={albumGridClass}>
          {albums.map((album) => (
            <AlbumGridCard key={album.id} album={album} />
          ))}
        </div>
      )
    }

    return (
      <div className={artistGridClass}>
        {artists.map((artist) => (
          <ArtistGridCard key={artist.id} artist={artist} />
        ))}
      </div>
    )
  }

  if (scope) {
    const counts = {
      songs: songs.length,
      albums: albums.length,
      artists: artists.length,
    }

    return (
      <LibraryPage
        header={
          <ShadowHeader fixed={false} showGlassEffect={false}>
            <div className="flex items-center gap-2">
              <Link
                to={ROUTES.FAVORITES.PAGE}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={t('sidebar.favorites')}
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <HeaderTitle
                title={t(scopeTitleKey[scope])}
                count={counts[scope]}
              />
            </div>
          </ShadowHeader>
        }
      >
        <ListWrapper>{renderScope(scope)}</ListWrapper>
      </LibraryPage>
    )
  }

  return (
    <LibraryPage
      header={
        <>
          <ShadowHeader fixed={false} showGlassEffect={false}>
            <HeaderTitle title={t('sidebar.favorites')} />
          </ShadowHeader>

          <LibraryToolbar>
            <LibraryFilterInput value={query} onChange={setQuery} />

            <div className="flex items-center gap-2 ml-auto">
              <LibraryPlaybackButtons
                shuffleOnly
                disabled={albums.length === 0 && songs.length === 0}
                loading={shuffling ? 'shuffle' : null}
                onPlay={() => {}}
                onShuffle={shuffleFavorites}
              />
            </div>
          </LibraryToolbar>
        </>
      }
    >
      <ListWrapper>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <HeartIcon className="size-10 opacity-40" />
            <p className="font-medium text-foreground">
              {search ? t('command.noResults') : t('favorites.empty')}
            </p>
            {!search && <p className="text-sm">{t('favorites.emptyInfo')}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {songs.length > 0 && (
              <Section
                title={t('favorites.tracks')}
                count={songs.length}
                scope="songs"
              >
                <div className="flex flex-col">
                  {songs.slice(0, PREVIEW_LIMIT).map((song, index) => (
                    <FavoriteSongRow
                      key={song.id}
                      song={song}
                      index={index}
                      onPlay={() => playSongs(index)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {albums.length > 0 && (
              <Section
                title={t('sidebar.albums')}
                count={albums.length}
                scope="albums"
              >
                <div className={albumGridClass}>
                  {albums.slice(0, PREVIEW_LIMIT).map((album) => (
                    <AlbumGridCard key={album.id} album={album} />
                  ))}
                </div>
              </Section>
            )}

            {artists.length > 0 && (
              <Section
                title={t('sidebar.artists')}
                count={artists.length}
                scope="artists"
              >
                <div className={artistGridClass}>
                  {artists.slice(0, PREVIEW_LIMIT).map((artist) => (
                    <ArtistGridCard key={artist.id} artist={artist} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </ListWrapper>
    </LibraryPage>
  )
}

function matches(search: string, ...values: (string | undefined)[]) {
  return (
    !search ||
    values.some((value) => value?.toLowerCase().includes(search) === true)
  )
}

interface SectionProps {
  title: string
  count: number
  scope: Scope
  children: ReactNode
}

function Section({ title, count, scope, children }: SectionProps) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
      {children}
      {count > PREVIEW_LIMIT && (
        <Link
          to={ROUTES.FAVORITES.SCOPE(scope)}
          className="w-fit text-sm text-primary hover:underline"
        >
          {t('favorites.showAll', { count })}
        </Link>
      )}
    </section>
  )
}
