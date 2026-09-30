import { PlayIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type LyricsSearchResult } from '@/api/lyrics'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { CoverImage } from '@/app/components/table/cover-image'
import { TableArtists } from '@/app/components/table/song-title'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes/routesList'
import { usePlayerCurrentSong, usePlayerIsPlaying } from '@/store/player.store'
import { Albums } from '@/types/responses/album'
import { ISimilarArtist } from '@/types/responses/artist'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'

const rowClass =
  'flex items-center gap-3 h-12 px-2.5 rounded-lg hover:bg-foreground/10 transition-colors'

interface ArtistRowProps {
  artist: ISimilarArtist
  onOpen: () => void
  albumsLabel?: string
}

export function SearchArtistRow({
  artist,
  onOpen,
  albumsLabel,
}: ArtistRowProps) {
  return (
    <Link
      to={ROUTES.ARTIST.PAGE(artist.id)}
      onClick={onOpen}
      className={rowClass}
      data-testid="search-artist"
    >
      <CoverImage
        coverArt={artist.coverArt}
        coverArtType="artist"
        altText={artist.name}
        size={36}
      />
      <div className="flex flex-col min-w-0">
        <span className="truncate text-sm font-medium">{artist.name}</span>
        {albumsLabel && (
          <span className="text-xs text-muted-foreground">{albumsLabel}</span>
        )}
      </div>
    </Link>
  )
}

interface AlbumRowProps {
  album: Albums
  onOpen: () => void
}

export function SearchAlbumRow({ album, onOpen }: AlbumRowProps) {
  const details = [album.artist, album.year ? String(album.year) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to={ROUTES.ALBUM.PAGE(album.id)}
      onClick={onOpen}
      className={rowClass}
      data-testid="search-album"
    >
      <CoverImage
        coverArt={album.coverArt}
        coverArtType="album"
        altText={album.name}
        size={36}
      />
      <div className="flex flex-col min-w-0">
        <span className="truncate text-sm font-medium">{album.name}</span>
        {details && (
          <span className="text-xs text-muted-foreground truncate">
            {details}
          </span>
        )}
      </div>
    </Link>
  )
}

interface SearchSongRowProps {
  song: ISong
  index: number
  onPlay: () => void
}

export function SearchSongRow({ song, index, onPlay }: SearchSongRowProps) {
  const currentSong = usePlayerCurrentSong()
  const isPlayerPlaying = usePlayerIsPlaying()
  const isCurrent = currentSong?.id === song.id

  return (
    <ContextMenuProvider
      options={<SongMenuOptions variant="context" song={song} index={index} />}
    >
      <div
        className="group flex items-center gap-3 h-12 px-2.5 rounded-lg select-none hover:bg-foreground/10 transition-colors"
        onDoubleClick={onPlay}
        data-testid="search-song-row"
      >
        <button
          type="button"
          onClick={onPlay}
          className="relative size-9 min-w-9 rounded overflow-hidden"
          aria-label={song.title}
        >
          <CoverImage
            coverArt={song.coverArt}
            coverArtType="song"
            altText={song.title}
            size={36}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayIcon className="size-3.5 fill-white text-white" />
          </span>
        </button>

        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            {isCurrent && isPlayerPlaying && (
              <EqualizerBars size={12} className="text-primary shrink-0" />
            )}
            <span
              className={cn(
                'truncate text-sm font-medium',
                isCurrent && 'text-primary',
              )}
            >
              {song.title}
            </span>
          </div>
          <div className="flex items-center truncate text-xs text-muted-foreground">
            <TableArtists song={song} />
          </div>
        </div>

        <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
          {convertSecondsToTime(song.duration ?? 0)}
        </span>
      </div>
    </ContextMenuProvider>
  )
}

interface SearchLyricsRowProps {
  item: LyricsSearchResult
  query: string
  onPlay: () => void
}

function HighlightedSnippet({
  snippet,
  query,
}: {
  snippet: string
  query: string
}) {
  const needle = query.trim()
  if (!snippet || !needle) {
    return (
      <span className="text-xs text-muted-foreground italic truncate">
        {snippet}
      </span>
    )
  }

  const lowerSnippet = snippet.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const idx = lowerSnippet.indexOf(lowerNeedle)

  if (idx === -1) {
    return (
      <span className="text-xs text-muted-foreground italic truncate">
        {snippet}
      </span>
    )
  }

  const before = snippet.slice(0, idx)
  const match = snippet.slice(idx, idx + needle.length)
  const after = snippet.slice(idx + needle.length)

  return (
    <span className="text-xs text-muted-foreground italic truncate">
      {before}
      <span className="text-primary font-semibold not-italic">{match}</span>
      {after}
    </span>
  )
}

export function SearchLyricsRow({ item, query, onPlay }: SearchLyricsRowProps) {
  const currentSong = usePlayerCurrentSong()
  const isPlayerPlaying = usePlayerIsPlaying()
  const isCurrent = currentSong?.id === item.songId

  // Mock an ISong object for the context menu
  const fallbackSong = {
    id: item.songId,
    title: item.songTitle ?? item.songId,
    artist: item.artistName ?? '',
    albumId: item.albumId ?? '',
    album: '',
    coverArt: item.coverArt ?? '',
    duration: item.duration ?? 0,
    parent: '',
    isDir: false,
    track: 0,
    year: 0,
    size: 0,
    contentType: 'audio/mpeg',
    suffix: 'mp3',
  } as ISong

  return (
    <ContextMenuProvider
      options={
        <SongMenuOptions variant="context" song={fallbackSong} index={0} />
      }
    >
      <div
        className="group flex items-center gap-3 h-12 px-2.5 rounded-lg select-none hover:bg-foreground/10 transition-colors"
        onDoubleClick={onPlay}
        data-testid="search-lyrics-row"
      >
        <button
          type="button"
          onClick={onPlay}
          className="relative size-9 min-w-9 rounded overflow-hidden"
          aria-label={item.songTitle ?? 'Song'}
        >
          <CoverImage
            coverArt={item.coverArt ?? ''}
            coverArtType="song"
            altText={item.songTitle ?? 'Song'}
            size={36}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayIcon className="size-3.5 fill-white text-white" />
          </span>
        </button>

        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            {isCurrent && isPlayerPlaying && (
              <EqualizerBars size={12} className="text-primary shrink-0" />
            )}
            <span
              className={cn(
                'truncate text-sm font-medium',
                isCurrent && 'text-primary',
              )}
            >
              {item.songTitle ?? item.songId}
            </span>
            {item.artistName && (
              <span className="text-xs text-muted-foreground truncate">
                · {item.artistName}
              </span>
            )}
          </div>
          <div className="flex items-center truncate">
            <HighlightedSnippet snippet={item.snippet} query={query} />
          </div>
        </div>

        {item.duration !== null && item.duration !== undefined && (
          <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
            {convertSecondsToTime(item.duration)}
          </span>
        )}
      </div>
    </ContextMenuProvider>
  )
}
