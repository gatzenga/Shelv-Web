import { PlayIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { CoverImage } from '@/app/components/table/cover-image'
import { TableArtists } from '@/app/components/table/song-title'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes/routesList'
import { usePlayerCurrentSong, usePlayerIsPlaying } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'

interface SongListRowProps {
  song: ISong
  index: number
  onPlay: () => void
}

// A song in a list like in the Shelv app: cover, title with the artist, the
// album and the time
export function SongListRow({ song, index, onPlay }: SongListRowProps) {
  const currentSong = usePlayerCurrentSong()
  const isPlayerPlaying = usePlayerIsPlaying()
  const isCurrent = currentSong?.id === song.id

  return (
    <ContextMenuProvider
      options={<SongMenuOptions variant="context" song={song} index={index} />}
    >
      <div
        className="group flex items-center gap-3 h-16 px-3 rounded-lg select-none hover:bg-foreground/10 transition-colors"
        onDoubleClick={onPlay}
        data-testid="song-list-row"
      >
        <button
          type="button"
          onClick={onPlay}
          className="relative size-10 min-w-10 rounded overflow-hidden"
          aria-label={song.title}
        >
          <CoverImage
            coverArt={song.coverArt}
            coverArtType="song"
            altText={song.title}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayIcon className="size-4 fill-white text-white" />
          </span>
        </button>

        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            {isCurrent && isPlayerPlaying && (
              <EqualizerBars size={14} className="text-primary shrink-0" />
            )}
            <span
              className={cn(
                'truncate text-sm font-medium',
                isCurrent && 'text-primary font-medium',
              )}
            >
              {song.title}
            </span>
          </div>
          <div className="flex items-center truncate">
            <TableArtists song={song} />
          </div>
        </div>

        {song.album && (
          <Link
            to={ROUTES.ALBUM.PAGE(song.albumId)}
            className="hidden md:block max-w-[200px] truncate text-xs text-muted-foreground hover:underline"
          >
            {song.album}
          </Link>
        )}

        <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
          {convertSecondsToTime(song.duration ?? 0)}
        </span>
      </div>
    </ContextMenuProvider>
  )
}
