import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { TableActionButton } from '@/app/components/table/action-button'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { cn } from '@/lib/utils'
import {
  usePlayerActions,
  usePlayerCurrentSong,
  usePlayerStore,
} from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'

interface TopSongsProps {
  topSongs: ISong[]
}

export default function ArtistTopSongs({ topSongs }: TopSongsProps) {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()
  const currentSong = usePlayerCurrentSong()
  const isPlayerPlaying = usePlayerStore((state) => state.playerState.isPlaying)

  const songsToShow = topSongs.slice(0, 8)
  const col1 = songsToShow.slice(0, 4)
  const col2 = songsToShow.slice(4, 8)

  if (songsToShow.length === 0) return null

  function renderSongRow(song: ISong, globalIndex: number) {
    const isCurrent = currentSong?.id === song.id
    const isSongPlaying = isCurrent && isPlayerPlaying

    return (
      <ContextMenuProvider
        key={song.id}
        options={
          <SongMenuOptions variant="context" song={song} index={globalIndex} />
        }
      >
        <div
          className={cn(
            'group/tablerow group flex items-center justify-between p-2 rounded-lg',
            'hover:bg-accent/60 transition-colors cursor-pointer select-none',
            isCurrent && 'bg-accent/40',
          )}
          onClick={() => setSongList(songsToShow, globalIndex)}
        >
          <div className="flex items-center min-w-0 flex-1 mr-2">
            {/* Rank Number / Equalizer */}
            <div className="w-6 shrink-0 flex items-center justify-center text-sm font-semibold text-muted-foreground mr-2">
              {isSongPlaying ? (
                <EqualizerBars size={14} className="text-primary mb-0.5" />
              ) : (
                <span className={cn(isCurrent && 'text-primary')}>
                  {globalIndex + 1}.
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
                <SongMenuOptions
                  variant="dropdown"
                  song={song}
                  index={globalIndex}
                />
              }
            />
          </div>
        </div>
      </ContextMenuProvider>
    )
  }

  return (
    <div className="w-full mb-6">
      <div className="mb-3">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t('artist.topSongs')}
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex flex-col gap-1">
          {col1.map((song, i) => renderSongRow(song, i))}
        </div>
        {col2.length > 0 && (
          <div className="flex flex-col gap-1">
            {col2.map((song, i) => renderSongRow(song, 4 + i))}
          </div>
        )}
      </div>
    </div>
  )
}
