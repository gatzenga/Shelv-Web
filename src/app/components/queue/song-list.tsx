import clsx from 'clsx'
import {
  GripVerticalIcon,
  InfinityIcon,
  ListMusicIcon,
  ListXIcon,
  PlayIcon,
  XIcon,
} from 'lucide-react'
import { DragEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CoverImage } from '@/app/components/table/cover-image'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { cn } from '@/lib/utils'
import {
  usePlayerActions,
  usePlayerContext,
  usePlayerCurrentSongIndex,
  usePlayerInfinityMode,
  usePlayerPlayNextQueue,
  usePlayerShuffle,
  usePlayerUpcomingAlbumQueue,
  usePlayerUserQueue,
} from '@/store/player.store'
import { PlaybackSource } from '@/types/playerContext'
import { ISong } from '@/types/responses/song'
import {
  convertSecondsToHumanRead,
  convertSecondsToTime,
} from '@/utils/convertSecondsToTime'

interface QueueRowProps {
  song: ISong
  index: number
  sectionId: string
  onPlay: () => void
  onRemove: () => void
  onMove: (from: number, to: number) => void
}

function QueueRow({
  song,
  index,
  sectionId,
  onPlay,
  onRemove,
  onMove,
}: QueueRowProps) {
  const [dropSide, setDropSide] = useState<'top' | 'bottom' | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ sectionId, fromIndex: index }),
    )
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropSide(e.clientY < midY ? 'top' : 'bottom')
  }

  function handleDragLeave() {
    setDropSide(null)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDropSide(null)
    setIsDragging(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (data.sectionId === sectionId && data.fromIndex !== index) {
        onMove(data.fromIndex, index)
      }
    } catch {
      // ignore
    }
  }

  function handleDragEnd() {
    setIsDragging(false)
    setDropSide(null)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onDoubleClick={onPlay}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-1.5 rounded-lg select-none cursor-pointer transition-colors',
        'hover:bg-accent/60',
        isDragging && 'opacity-40',
        dropSide === 'top' && 'border-t-2 border-primary',
        dropSide === 'bottom' && 'border-b-2 border-primary',
      )}
    >
      <div className="relative w-9 h-9 shrink-0 rounded overflow-hidden">
        <CoverImage
          coverArt={song.coverArt}
          coverArtType="song"
          size={36}
          altText={song.title}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded cursor-pointer"
          title="Play"
        >
          <PlayIcon className="w-4 h-4 text-white fill-white" />
        </button>
      </div>

      <div className="flex flex-col min-w-0 flex-1 justify-center">
        <span className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
          {song.title}
        </span>
        {song.artist && (
          <span className="text-xs text-muted-foreground truncate">
            {song.artist}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground font-mono">
          {convertSecondsToTime(song.duration ?? 0)}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 p-0 rounded-full opacity-0 group-hover:opacity-100 hover:bg-background/80 text-muted-foreground hover:text-foreground transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <XIcon className="w-4 h-4" />
        </Button>

        <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors">
          <GripVerticalIcon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

export function QueueSongList() {
  const { t } = useTranslation()
  const playNextQueue = usePlayerPlayNextQueue()
  const upcomingAlbum = usePlayerUpcomingAlbumQueue()
  const userQueue = usePlayerUserQueue()
  const currentSongIndex = usePlayerCurrentSongIndex()
  const isShuffleActive = usePlayerShuffle()
  const infinityModeEnabled = usePlayerInfinityMode()
  const { source } = usePlayerContext()

  const {
    jumpToPlayNext,
    jumpToQueueTrack,
    jumpToUserQueue,
    removeFromPlayNextQueue,
    removeFromPlayQueue,
    removeFromUserQueue,
    moveInPlayNextQueue,
    moveInUpcomingQueue,
    moveInUserQueue,
    toggleInfinityMode,
    clearQueue,
  } = usePlayerActions()

  const totalCount =
    playNextQueue.length + upcomingAlbum.length + userQueue.length

  const totalDuration = useMemo(() => {
    let seconds = 0
    playNextQueue.forEach((s) => {
      seconds += s.duration ?? 0
    })
    upcomingAlbum.forEach((s) => {
      seconds += s.duration ?? 0
    })
    userQueue.forEach((s) => {
      seconds += s.duration ?? 0
    })
    return convertSecondsToHumanRead(seconds)
  }, [playNextQueue, upcomingAlbum, userQueue])

  function getSourceLabel(src: PlaybackSource | null) {
    if (!src) return null
    return src.name
  }

  const sourceLabel = getSourceLabel(source)

  return (
    <div className="flex flex-1 flex-col h-full min-w-0">
      <div className="flex items-center justify-between gap-2 h-8 mb-2">
        <div className="flex gap-1.5 items-center text-muted-foreground text-xs whitespace-nowrap min-w-0">
          {sourceLabel && (
            <>
              <span className="truncate text-foreground font-medium">
                {sourceLabel}
              </span>
              <span className="shrink-0">•</span>
            </>
          )}
          <span className="shrink-0">
            {t('playlist.songCount', { count: totalCount })}
          </span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">
            {t('playlist.duration', { duration: totalDuration })}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <SimpleTooltip
            text={
              infinityModeEnabled
                ? t('queue.infinityMixDisable')
                : t('queue.infinityMixEnable')
            }
          >
            <Button
              variant="ghost"
              size="icon"
              className={clsx(
                'h-8 w-8 shrink-0 rounded-md transition-all',
                infinityModeEnabled
                  ? 'text-primary bg-primary/20 hover:bg-primary/30 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
              onClick={toggleInfinityMode}
            >
              <InfinityIcon className="w-4 h-4" />
            </Button>
          </SimpleTooltip>

          <SimpleTooltip text={t('queue.clear')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={clearQueue}
            >
              <ListXIcon className="w-4 h-4" />
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      <Separator />

      <div className="w-full flex-1 overflow-y-auto min-h-0 pb-2 space-y-4">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <ListMusicIcon className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">{t('queue.empty')}</p>
          </div>
        ) : (
          <>
            {playNextQueue.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur z-10">
                  <span>{t('queue.playNext')}</span>
                  <span className="text-[11px] font-normal lowercase tracking-normal text-muted-foreground/80">
                    {t('queue.songsCount', { count: playNextQueue.length })}
                  </span>
                </div>
                {playNextQueue.map((song, idx) => (
                  <QueueRow
                    key={`pn-${song.id}-${idx}`}
                    song={song}
                    index={idx}
                    sectionId="playNext"
                    onPlay={() => jumpToPlayNext(idx)}
                    onRemove={() => removeFromPlayNextQueue(idx)}
                    onMove={moveInPlayNextQueue}
                  />
                ))}
              </div>
            )}

            {upcomingAlbum.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur z-10">
                  <span>
                    {isShuffleActive
                      ? t('queue.shuffledQueue')
                      : t('queue.upNext')}
                  </span>
                  <span className="text-[11px] font-normal lowercase tracking-normal text-muted-foreground/80">
                    {t('queue.songsCount', { count: upcomingAlbum.length })}
                  </span>
                </div>
                {upcomingAlbum.map((song, idx) => (
                  <QueueRow
                    key={`alb-${song.id}-${idx}`}
                    song={song}
                    index={idx}
                    sectionId="upcoming"
                    onPlay={() => jumpToQueueTrack(currentSongIndex + 1 + idx)}
                    onRemove={() =>
                      removeFromPlayQueue(currentSongIndex + 1 + idx)
                    }
                    onMove={moveInUpcomingQueue}
                  />
                ))}
              </div>
            )}

            {userQueue.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur z-10">
                  <span>{t('queue.yourQueue')}</span>
                  <span className="text-[11px] font-normal lowercase tracking-normal text-muted-foreground/80">
                    {t('queue.songsCount', { count: userQueue.length })}
                  </span>
                </div>
                {userQueue.map((song, idx) => (
                  <QueueRow
                    key={`uq-${song.id}-${idx}`}
                    song={song}
                    index={idx}
                    sectionId="userQueue"
                    onPlay={() => jumpToUserQueue(idx)}
                    onRemove={() => removeFromUserQueue(idx)}
                    onMove={moveInUserQueue}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
