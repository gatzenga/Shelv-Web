import { Play } from 'lucide-react'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { TableActionButton } from '@/app/components/table/action-button'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { cn } from '@/lib/utils'
import { usePlayerCurrentSong, usePlayerStore } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'

interface TopSongRowProps {
  song: ISong
  // the place in the list, it shows as the rank
  index: number
  onPlay: () => void
}

// One top song: the rank, the cover, the title with the artist, the duration
// and the menu. On the artist page and on the page of all top songs.
export function TopSongRow({ song, index, onPlay }: TopSongRowProps) {
  const currentSong = usePlayerCurrentSong()
  const isPlayerPlaying = usePlayerStore((state) => state.playerState.isPlaying)

  const isCurrent = currentSong?.id === song.id
  const isSongPlaying = isCurrent && isPlayerPlaying

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
        onClick={onPlay}
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          {/* Rank Number / Equalizer */}
          <div className="w-6 shrink-0 flex items-center justify-center text-sm font-semibold text-muted-foreground mr-2">
            {isSongPlaying ? (
              <EqualizerBars size={14} className="text-primary mb-0.5" />
            ) : (
              <span className={cn(isCurrent && 'text-primary')}>
                {index + 1}.
              </span>
            )}
          </div>

          {/* Album Cover Thumbnail */}
          <div className="w-11 h-11 min-w-11 min-h-11 rounded-md overflow-hidden relative bg-skeleton shadow-sm shrink-0">
            <ImageLoader id={song.coverArt} type="album" size="80">
              {(src) => (
                <LazyLoadImage
                  src={src}
                  alt={song.title}
                  effect="opacity"
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              )}
            </ImageLoader>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Title & Artist */}
          <div className="flex flex-col min-w-0 flex-1 ml-3 justify-center">
            <span
              className={cn(
                'text-sm font-medium truncate leading-tight',
                isCurrent && 'text-primary',
              )}
            >
              {song.title}
            </span>
            <span className="text-xs text-muted-foreground truncate leading-normal mt-0.5">
              {song.artist}
            </span>
          </div>
        </div>

        {/* Duration & 3-dots Menu */}
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
