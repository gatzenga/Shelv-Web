import { XIcon } from 'lucide-react'
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
// being covered. Switching between the two happens via the player buttons.
export function SidePanel() {
  const { t } = useTranslation()
  const { mainDrawerState, closeDrawer } = useMainDrawerState()
  const { queueState } = useQueueState()
  const { lyricsState } = useLyricsState()

  if (!mainDrawerState) return null

  return (
    <>
      <div className="w-[28rem] min-w-[28rem] shrink-0" />
      <aside
        className="fixed right-0 top-header bottom-player h-content w-[28rem] z-20 flex flex-col border-l bg-background"
        data-testid="side-panel"
      >
        {queueState && <QueueSongList onClose={closeDrawer} />}
        {lyricsState && (
          <>
            <div className="flex items-center justify-between h-12 min-h-12 px-4 border-b">
              <h2 className="text-base font-semibold">
                {t('fullscreen.lyrics')}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={closeDrawer}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-1 min-h-0 px-3 py-2">
              <LyricsTab />
            </div>
          </>
        )}
      </aside>
    </>
  )
}
