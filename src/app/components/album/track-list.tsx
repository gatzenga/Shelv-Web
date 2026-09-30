import { HeartIcon, PlayIcon } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { TableArtists } from '@/app/components/table/song-title'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app.store'
import { usePlayerCurrentSong, usePlayerIsPlaying } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'

interface AlbumTrackListProps {
  songs: ISong[]
  onPlay: (index: number) => void
}

// The tracks like in the Shelv app: the number, the title with the artist
// below and the time, nothing else
export function AlbumTrackList({ songs, onPlay }: AlbumTrackListProps) {
  const { t } = useTranslation()

  const discs = useMemo(() => {
    const numbers = new Set(songs.map((song) => song.discNumber ?? 1))
    if (numbers.size < 2) return null

    return [...numbers].sort((a, b) => a - b)
  }, [songs])

  return (
    <div className="flex flex-col px-5 pb-2" data-testid="album-track-list">
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
            <TrackRow song={song} index={index} onPlay={() => onPlay(index)} />
          </Fragment>
        )
      })}
    </div>
  )
}

interface TrackRowProps {
  song: ISong
  index: number
  onPlay: () => void
}

function TrackRow({ song, index, onPlay }: TrackRowProps) {
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
          'group flex items-center h-[52px] rounded-md select-none',
          'hover:bg-foreground/10 transition-colors',
        )}
        onDoubleClick={onPlay}
        data-testid="album-track"
      >
        <button
          type="button"
          onClick={onPlay}
          className="w-12 shrink-0 flex items-center justify-center text-sm text-muted-foreground"
          aria-label={song.title}
        >
          <span className="group-hover:hidden">
            {isCurrent && isPlayerPlaying ? (
              <EqualizerBars size={14} className="text-primary" />
            ) : (
              <span className={cn(isCurrent && 'text-primary')}>
                {song.track ?? ''}
              </span>
            )}
          </span>
          <PlayIcon className="hidden group-hover:block size-4 fill-current text-foreground" />
        </button>

        <div className="flex flex-col min-w-0 flex-1 ml-2 justify-center">
          <span
            className={cn('truncate', isCurrent && 'text-primary font-medium')}
          >
            {song.title}
          </span>
          <div className="flex items-center truncate">
            <TableArtists song={song} />
          </div>
        </div>

        <div className="flex items-center gap-3 pr-4 shrink-0">
          {isStarred && (
            <HeartIcon className="size-3.5 fill-red-500 text-red-500" />
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            {convertSecondsToTime(song.duration ?? 0)}
          </span>
        </div>
      </div>
    </ContextMenuProvider>
  )
}
