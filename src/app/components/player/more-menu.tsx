import { CircleEllipsisIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OptionsButtons } from '@/app/components/options/buttons'
import { AddToPlaylistSubMenu } from '@/app/components/song/add-to-playlist'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { useOptions } from '@/app/hooks/use-options'
import { useShare } from '@/app/hooks/use-share'
import { useAppStore } from '@/store/app.store'
import { ISong } from '@/types/responses/song'

interface PlayerMoreMenuProps {
  song?: ISong
}

// The menu of the current song, as in the player of the Shelv app
export function PlayerMoreMenu({ song }: PlayerMoreMenuProps) {
  const { t } = useTranslation()
  const {
    playNext,
    playLast,
    startInstantMix,
    createNewPlaylist,
    addToPlaylist,
  } = useOptions()
  const { share } = useShare()
  const hidePlaylistsSection = useAppStore().pages.hidePlaylistsSection

  return (
    <DropdownMenu>
      <SimpleTooltip text={t('generic.options')}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            disabled={!song?.id}
            className="relative rounded-full size-10 p-0 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0"
            data-testid="player-button-more"
          >
            <CircleEllipsisIcon className="text-secondary-foreground" />
          </Button>
        </DropdownMenuTrigger>
      </SimpleTooltip>
      {song && (
        <DropdownMenuContent align="end" side="top" className="min-w-52">
          <OptionsButtons.InstantMix
            onClick={() => startInstantMix('song', song.id)}
          />
          <OptionsButtons.PlayNext onClick={() => playNext([song])} />
          <OptionsButtons.PlayLast onClick={() => playLast([song])} />
          {!hidePlaylistsSection && (
            <OptionsButtons.AddToPlaylistOption>
              <AddToPlaylistSubMenu
                type="dropdown"
                newPlaylistFn={() => createNewPlaylist(song.title, song.id)}
                addToPlaylistFn={(id) => addToPlaylist(id, song.id)}
              />
            </OptionsButtons.AddToPlaylistOption>
          )}
          <DropdownMenuSeparator />
          <OptionsButtons.Share onClick={() => share(song.id)} />
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
