import clsx from 'clsx'
import { XIcon } from 'lucide-react'
import { ComponentPropsWithoutRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueSongList } from '@/app/components/queue/song-list'
import { Button } from '@/app/components/ui/button'
import {
  useLyricsState,
  useMainDrawerState,
  useQueueState,
} from '@/store/player.store'
import { LyricsTab } from './lyrics'

// Queue and lyrics open as a fixed panel on the right, like the sidebar on
// the left: between header and player, the page gets narrower instead of
// being covered.
export function SidePanel() {
  const { t } = useTranslation()
  const { mainDrawerState, closeDrawer } = useMainDrawerState()
  const { queueState, setQueueState } = useQueueState()
  const { lyricsState, setLyricsState } = useLyricsState()

  if (!mainDrawerState) return null

  function showQueue() {
    setQueueState(true)
    setLyricsState(false)
  }

  function showLyrics() {
    setQueueState(false)
    setLyricsState(true)
  }

  return (
    <>
      <div className="w-[28rem] min-w-[28rem] shrink-0" />
      <aside
        className="fixed right-0 top-header bottom-player h-content w-[28rem] z-20 flex flex-col border-l bg-background"
        data-testid="side-panel"
      >
        <div className="flex items-center gap-1 h-12 min-h-12 px-3 border-b">
          <PanelTab active={lyricsState} onClick={showLyrics}>
            {t('fullscreen.lyrics')}
          </PanelTab>
          <PanelTab active={queueState} onClick={showQueue}>
            {t('queue.title')}
          </PanelTab>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 rounded-md"
            onClick={closeDrawer}
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-1 min-h-0 px-3 py-2">
          {queueState && <QueueSongList />}
          {lyricsState && <LyricsTab />}
        </div>
      </aside>
    </>
  )
}

type PanelTabProps = ComponentPropsWithoutRef<'button'> & {
  active: boolean
}

function PanelTab({ active, className, ...props }: PanelTabProps) {
  return (
    <button
      type="button"
      className={clsx(
        'h-8 px-3 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
