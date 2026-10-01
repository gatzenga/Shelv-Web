import { HeartIcon } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { TableActionButton } from '@/app/components/table/action-button'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { TableArtists } from '@/app/components/table/song-title'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app.store'
import { usePlayerCurrentSong, usePlayerIsPlaying } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'
import { playOnClick } from '@/utils/rowClick'

interface AlbumTrackListProps {
  songs: ISong[]
  onPlay: (index: number) => void
  // an album shows the track numbers and the discs, a playlist its positions
  numbering?: 'track' | 'position'
}

// The tracks like in the Shelv app: the number, the title with the artist
// below, the duration, and action menu
export function AlbumTrackList({
  songs,
  onPlay,
  numbering = 'track',
}: AlbumTrackListProps) {
  const { t } = useTranslation()

  const discs = useMemo(() => {
    const numbers = new Set(songs.map((song) => song.discNumber ?? 1))
    if (numbering === 'position' || numbers.size < 2) return null

    return [...numbers].sort((a, b) => a - b)
  }, [songs, numbering])

  return (
    <div
      className="flex flex-col px-5 pt-3 pb-2"
      data-testid="album-track-list"
    >
      {songs.map((song, index) => {
        const isFirstOfDisc =
          discs !== null &&
          (index === 0 ||
            (songs[index - 1].discNumber ?? 1) !== (song.discNumber ?? 1))

        return (
          <Fragment key={song.id}>
            {isFirstOfDisc && (
              <div className="px-3 pt-4 pb-2 mb-1 text-sm text-muted-foreground border-b">
                {t('album.disc', { number: song.discNumber ?? 1 })}
              </div>
            )}
            <TrackRow
              song={song}
              index={index}
              position={numbering === 'position'}
              onPlay={() => onPlay(index)}
            />
          </Fragment>
        )
      })}
    </div>
  )
}

interface TrackRowProps {
  song: ISong
  index: number
  position: boolean
  onPlay: () => void
}

function TrackRow({ song, index, position, onPlay }: TrackRowProps) {
  const currentSong = usePlayerCurrentSong()
  const isPlayerPlaying = usePlayerIsPlaying()
  const hideFavorites = useAppStore().pages.hideFavoritesSection

  const isCurrent = currentSong?.id === song.id
  const isStarred = song.starred !== undefined && !hideFavorites

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
        data-testid="album-track"
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          {/* Track Number / Equalizer */}
          <div className="w-6 shrink-0 flex items-center justify-center text-sm font-semibold text-muted-foreground mr-2">
            {isCurrent && isPlayerPlaying ? (
              <EqualizerBars size={14} className="text-primary mb-0.5" />
            ) : (
              <span className={cn(isCurrent && 'text-primary')}>
                {position ? index + 1 : (song.track ?? index + 1)}
              </span>
            )}
          </div>

          {/* Title & Artist */}
          <div className="flex flex-col min-w-0 flex-1 ml-1 justify-center">
            <span
              className={cn(
                'text-sm font-medium truncate leading-tight',
                isCurrent && 'text-primary',
              )}
            >
              {song.title}
            </span>
            <div className="text-xs text-muted-foreground truncate leading-normal mt-0.5">
              <TableArtists song={song} />
            </div>
          </div>
        </div>

        {/* Duration & 3-dots Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isStarred && (
            <HeartIcon className="size-3.5 fill-red-500 text-red-500 mr-1" />
          )}
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
