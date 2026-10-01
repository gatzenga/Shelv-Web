import { PlayIcon } from 'lucide-react'
import { type LyricsSearchResult } from '@/api/lyrics'
import { AlbumOptions } from '@/app/components/album/options'
import { ArtistOptions } from '@/app/components/artist/options'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { TableActionButton } from '@/app/components/table/action-button'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { CoverImage } from '@/app/components/table/cover-image'
import { TableArtists } from '@/app/components/table/song-title'
import { cn } from '@/lib/utils'
import { usePlayerCurrentSong, usePlayerIsPlaying } from '@/store/player.store'
import { Albums } from '@/types/responses/album'
import { ISimilarArtist } from '@/types/responses/artist'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'
import { playOnClick } from '@/utils/rowClick'

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
    <ContextMenuProvider
      options={<ArtistOptions artist={artist} variant="context" />}
    >
      <div
        className={cn(
          'group/tablerow group flex items-center justify-between p-2 rounded-lg',
          'hover:bg-accent/60 transition-colors cursor-pointer select-none',
        )}
        onClick={onOpen}
        data-testid="search-artist"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="size-11 min-w-11 min-h-11 rounded-full overflow-hidden shrink-0 shadow-sm">
            <CoverImage
              coverArt={artist.coverArt}
              coverArtType="artist"
              altText={artist.name}
              size={44}
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <span className="truncate text-sm font-medium leading-tight">
              {artist.name}
            </span>
            {albumsLabel && (
              <span className="text-xs text-muted-foreground truncate leading-normal mt-0.5">
                {albumsLabel}
              </span>
            )}
          </div>
        </div>
        <div
          className="flex items-center shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <TableActionButton
            alwaysVisible
            optionsMenuItems={<ArtistOptions artist={artist} />}
          />
        </div>
      </div>
    </ContextMenuProvider>
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
    <ContextMenuProvider
      options={<AlbumOptions album={album} variant="context" />}
    >
      <div
        className={cn(
          'group/tablerow group flex items-center justify-between p-2 rounded-lg',
          'hover:bg-accent/60 transition-colors cursor-pointer select-none',
        )}
        onClick={onOpen}
        data-testid="search-album"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="w-11 h-11 min-w-11 min-h-11 rounded-md overflow-hidden shrink-0 shadow-sm">
            <CoverImage
              coverArt={album.coverArt}
              coverArtType="album"
              altText={album.name}
              size={44}
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <span className="truncate text-sm font-medium leading-tight">
              {album.name}
            </span>
            {details && (
              <span className="text-xs text-muted-foreground truncate leading-normal mt-0.5">
                {details}
              </span>
            )}
          </div>
        </div>
        <div
          className="flex items-center shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <TableActionButton
            alwaysVisible
            optionsMenuItems={<AlbumOptions album={album} />}
          />
        </div>
      </div>
    </ContextMenuProvider>
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
        className={cn(
          'group/tablerow group flex items-center justify-between p-2 rounded-lg',
          'hover:bg-accent/60 transition-colors cursor-pointer select-none',
          isCurrent && 'bg-accent/40',
        )}
        onClick={playOnClick(onPlay)}
        data-testid="search-song-row"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="w-11 h-11 min-w-11 min-h-11 rounded-md overflow-hidden relative shrink-0 shadow-sm">
            <CoverImage
              coverArt={song.coverArt}
              coverArtType="song"
              altText={song.title}
              size={44}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <PlayIcon className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              {isCurrent && isPlayerPlaying && (
                <EqualizerBars size={12} className="text-primary shrink-0" />
              )}
              <span
                className={cn(
                  'truncate text-sm font-medium leading-tight',
                  isCurrent && 'text-primary',
                )}
              >
                {song.title}
              </span>
            </div>
            <div className="flex items-center truncate text-xs text-muted-foreground leading-normal mt-0.5">
              <TableArtists song={song} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {convertSecondsToTime(song.duration ?? 0)}
          </span>
          <TableActionButton
            alwaysVisible
            optionsMenuItems={
              <SongMenuOptions variant="dropdown" song={song} index={index} />
            }
          />
        </div>
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

  // Mock an ISong object for the context/dropdown menu
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
        className={cn(
          'group/tablerow group flex items-center justify-between p-2 rounded-lg',
          'hover:bg-accent/60 transition-colors cursor-pointer select-none',
          isCurrent && 'bg-accent/40',
        )}
        onClick={playOnClick(onPlay)}
        data-testid="search-lyrics-row"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="w-11 h-11 min-w-11 min-h-11 rounded-md overflow-hidden relative shrink-0 shadow-sm">
            <CoverImage
              coverArt={item.coverArt ?? ''}
              coverArtType="song"
              altText={item.songTitle ?? 'Song'}
              size={44}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <PlayIcon className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              {isCurrent && isPlayerPlaying && (
                <EqualizerBars size={12} className="text-primary shrink-0" />
              )}
              <span
                className={cn(
                  'truncate text-sm font-medium leading-tight',
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
            <div className="flex items-center truncate leading-normal mt-0.5">
              <HighlightedSnippet snippet={item.snippet} query={query} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {item.duration !== null && item.duration !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {convertSecondsToTime(item.duration)}
            </span>
          )}
          <TableActionButton
            alwaysVisible
            optionsMenuItems={
              <SongMenuOptions
                variant="dropdown"
                song={fallbackSong}
                index={0}
              />
            }
          />
        </div>
      </div>
    </ContextMenuProvider>
  )
}
