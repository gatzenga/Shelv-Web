import {
  GripVerticalIcon,
  InfinityIcon,
  ListMusicIcon,
  PlayIcon,
  XIcon,
} from 'lucide-react'
import { DragEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SongMenuOptions } from '@/app/components/song/menu-options'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { CoverImage } from '@/app/components/table/cover-image'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  usePlayerActions,
  usePlayerCurrentSongIndex,
  usePlayerInfinityMode,
  usePlayerPlayNextQueue,
  usePlayerShuffle,
  usePlayerUpcomingAlbumQueue,
  usePlayerUserQueue,
} from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { convertSecondsToTime } from '@/utils/convertSecondsToTime'

interface QueueRowProps {
  song: ISong
  index: number
  sectionId: string
  isEditing: boolean
  onPlay: () => void
  onRemove: () => void
  onMove: (from: number, to: number) => void
}

function QueueRow({
  song,
  index,
  sectionId,
  isEditing,
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
    <ContextMenuProvider
      options={<SongMenuOptions variant="context" song={song} index={index} />}
    >
      <div
        draggable={isEditing}
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

        <div className="flex items-center justify-end gap-2 shrink-0 min-w-[3.5rem]">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 p-0 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <XIcon className="w-4 h-4" />
              </Button>

              <div className="cursor-grab active:cursor-grabbing text-primary">
                <GripVerticalIcon className="w-4 h-4" />
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">
              {convertSecondsToTime(song.duration ?? 0)}
            </span>
          )}
        </div>
      </div>
    </ContextMenuProvider>
  )
}

interface QueueSongListProps {
  onClose: () => void
}

export function QueueSongList({ onClose }: QueueSongListProps) {
  const { t } = useTranslation()
  const [isEditMode, setIsEditMode] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const playNextQueue = usePlayerPlayNextQueue()
  const upcomingAlbum = usePlayerUpcomingAlbumQueue()
  const userQueue = usePlayerUserQueue()
  const currentSongIndex = usePlayerCurrentSongIndex()
  const isShuffleActive = usePlayerShuffle()
  const infinityModeEnabled = usePlayerInfinityMode()

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

  const isEditing = isEditMode && totalCount > 0

  return (
    <div className="flex flex-1 flex-col h-full min-w-0">
      <div className="flex items-center justify-between gap-2 h-12 min-h-12 px-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold">{t('queue.title')}</h2>
          {totalCount > 0 && (
            <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
              {totalCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {totalCount > 0 && (
            <>
              <button
                type="button"
                className={cn(
                  'text-sm font-semibold transition-colors hover:text-primary',
                  isEditing ? 'text-primary' : 'text-muted-foreground',
                )}
                onClick={() => setIsEditMode(!isEditing)}
              >
                {isEditing ? t('queue.done') : t('queue.edit')}
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                onClick={() => setShowClearConfirm(true)}
              >
                {t('queue.clearShort')}
              </button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onClose}
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
        <label
          htmlFor="infinity-mode"
          className="flex items-center gap-2 text-sm cursor-pointer"
        >
          <InfinityIcon className="w-4 h-4 text-muted-foreground" />
          {t('queue.infinityMode')}
        </label>
        <Switch
          id="infinity-mode"
          checked={infinityModeEnabled}
          onCheckedChange={toggleInfinityMode}
        />
      </div>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('queue.clearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('queue.clearConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('queue.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={clearQueue}>
              {t('queue.clearShort')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full flex-1 overflow-y-auto min-h-0 px-2 py-2 space-y-4">
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
                    isEditing={isEditing}
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
                    isEditing={isEditing}
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
                    isEditing={isEditing}
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
