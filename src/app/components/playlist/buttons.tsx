import {
  EllipsisIcon,
  ListEndIcon,
  ListPlusIcon,
  PlayIcon,
  ShuffleIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { Action, plainButton } from '@/app/components/album/action-buttons'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { useOptions } from '@/app/hooks/use-options'
import { cn } from '@/lib/utils'
import {
  useIsPlaylistPlaying,
  usePlayerActions,
  usePlayerStore,
} from '@/store/player.store'
import { PlaybackSource } from '@/types/playerContext'
import { PlaylistWithEntries } from '@/types/responses/playlist'
import { PlaylistOptions } from './options'

interface PlaylistButtonsProps {
  playlist: PlaylistWithEntries
}

// The same buttons as on an album: Play always starts over, pausing is done
// in the player
export function PlaylistButtons({ playlist }: PlaylistButtonsProps) {
  const { t } = useTranslation()
  const { setSongList, toggleShuffle } = usePlayerActions()
  const { playNext, playLast } = useOptions()
  const { isPlaylistActive } = useIsPlaylistPlaying(playlist.id)
  const isShuffleActive = usePlayerStore(
    (state) => state.playerState.isShuffleActive,
  )
  const hasSongs = playlist.entry?.length > 0

  const playbackSource: PlaybackSource = {
    id: playlist.id,
    name: playlist.name,
    type: 'playlist',
  }

  function handleShuffleButton() {
    if (isPlaylistActive) {
      toggleShuffle()
    } else {
      setSongList(playlist.entry, 0, true, playbackSource)
    }
  }

  return (
    <div className="@container/actions w-full mb-6">
      <div className="flex flex-wrap items-center gap-1.5 @[28rem]/actions:gap-2.5">
        {hasSongs && (
          <>
            <Action
              icon={PlayIcon}
              label={t('options.play')}
              onClick={() =>
                setSongList(playlist.entry, 0, false, playbackSource)
              }
              prominent
            />
            <Action
              icon={ShuffleIcon}
              label={t('album.actions.shuffle')}
              onClick={handleShuffleButton}
              active={isPlaylistActive && isShuffleActive}
            />
            <Action
              icon={ListPlusIcon}
              label={t('options.playNext')}
              onClick={() => {
                playNext(playlist.entry)
                toast.success(t('album.actions.addedToPlayNext'))
              }}
            />
            <Action
              icon={ListEndIcon}
              label={t('options.addLast')}
              onClick={() => {
                playLast(playlist.entry)
                toast.success(t('album.actions.addedToQueue'))
              }}
            />
          </>
        )}

        <DropdownMenu>
          <SimpleTooltip text={t('generic.options')}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                aria-label={t('generic.options')}
                className={cn(
                  'size-9 rounded-full px-0 @[28rem]/actions:size-10 shrink-0',
                  plainButton,
                )}
              >
                <EllipsisIcon className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
          </SimpleTooltip>
          <DropdownMenuContent align="start" className="min-w-52">
            <PlaylistOptions
              playlist={playlist}
              showPlay={false}
              hideQueueActions
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
