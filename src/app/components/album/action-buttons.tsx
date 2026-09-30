import {
  HeartIcon,
  InfoIcon,
  ListEndIcon,
  ListMusicIcon,
  ListPlusIcon,
  PlayIcon,
  Share2Icon,
  ShuffleIcon,
  SparklesIcon,
} from 'lucide-react'
import { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { AddToPlaylistSubMenu } from '@/app/components/song/add-to-playlist'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { useOptions } from '@/app/hooks/use-options'
import { useShare } from '@/app/hooks/use-share'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app.store'
import { SingleAlbum } from '@/types/responses/album'

interface ActionProps {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  prominent?: boolean
  active?: boolean
}

// The row is a container: with room it shows icon and label, with less room
// only the icons, and with very little room smaller round icons, like the
// album screen of the Shelv app
const shapeClasses =
  'size-9 rounded-full px-0 @[28rem]/actions:size-10 @[58rem]/actions:w-auto @[58rem]/actions:gap-2 @[58rem]/actions:px-4'

const plainButton = 'bg-foreground/10 hover:bg-foreground/15 text-foreground'

const Action = ({
  icon: Icon,
  label,
  onClick,
  prominent,
  active,
}: ActionProps) => (
  <SimpleTooltip text={label}>
    <Button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        shapeClasses,
        'font-semibold shrink-0',
        prominent
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 @[58rem]/actions:min-w-[110px]'
          : plainButton,
        active && 'text-primary',
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="hidden @[58rem]/actions:inline">{label}</span>
    </Button>
  </SimpleTooltip>
)

interface AlbumActionButtonsProps {
  album: SingleAlbum
  isAlbumActive: boolean
  isShuffleActive: boolean
  isStarred: boolean
  showInfoButton: boolean
  infoShown: boolean
  onPlay: () => void
  onShuffle: () => void
  onToggleStar: () => void
  onToggleInfo: () => void
}

export function AlbumActionButtons({
  album,
  isAlbumActive,
  isShuffleActive,
  isStarred,
  showInfoButton,
  infoShown,
  onPlay,
  onShuffle,
  onToggleStar,
  onToggleInfo,
}: AlbumActionButtonsProps) {
  const { t } = useTranslation()
  const {
    playNext,
    playLast,
    startInstantMix,
    addToPlaylist,
    createNewPlaylist,
  } = useOptions()
  const { share } = useShare()
  const pages = useAppStore().pages
  const hasSongs = album.song.length > 0

  function addPlaylistTrigger(): ReactNode {
    const label = t('options.playlist.add')

    return (
      <DropdownMenu>
        <SimpleTooltip text={label}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label={label}
              className={cn(
                shapeClasses,
                plainButton,
                'font-semibold shrink-0',
              )}
            >
              <ListMusicIcon className="size-[18px] shrink-0" />
              <span className="hidden @[58rem]/actions:inline">{label}</span>
            </Button>
          </DropdownMenuTrigger>
        </SimpleTooltip>
        <DropdownMenuContent align="start">
          <AddToPlaylistSubMenu
            type="dropdown"
            newPlaylistFn={() =>
              createNewPlaylist(
                album.name,
                album.song.map((song) => song.id),
              )
            }
            addToPlaylistFn={(id) =>
              addToPlaylist(
                id,
                album.song.map((song) => song.id),
              )
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="@container/actions w-full mb-6">
      <div className="flex flex-wrap items-center gap-1.5 @[28rem]/actions:gap-2.5">
        <Action
          icon={PlayIcon}
          label={t('options.play')}
          onClick={onPlay}
          prominent
        />

        {album.song.length > 1 && (
          <Action
            icon={ShuffleIcon}
            label={t('album.actions.shuffle')}
            onClick={onShuffle}
            active={isAlbumActive && isShuffleActive}
          />
        )}

        <Action
          icon={SparklesIcon}
          label={t('options.instantMix')}
          onClick={() => startInstantMix('album', album.id)}
        />

        {hasSongs && (
          <>
            <Action
              icon={ListPlusIcon}
              label={t('options.playNext')}
              onClick={() => {
                playNext(album.song)
                toast.success(t('album.actions.addedToPlayNext'))
              }}
            />
            <Action
              icon={ListEndIcon}
              label={t('options.addLast')}
              onClick={() => {
                playLast(album.song)
                toast.success(t('album.actions.addedToQueue'))
              }}
            />
          </>
        )}

        {!pages.hidePlaylistsSection && hasSongs && addPlaylistTrigger()}

        <Action
          icon={Share2Icon}
          label={t('options.share')}
          onClick={() => share(album.id)}
        />

        {!pages.hideFavoritesSection && (
          <SimpleTooltip
            text={
              isStarred
                ? t('album.buttons.dislike', { name: album.name })
                : t('album.buttons.like', { name: album.name })
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={onToggleStar}
              className="size-9 shrink-0 rounded-full p-0 @[28rem]/actions:size-10"
            >
              <HeartIcon
                className={cn(
                  'size-5',
                  isStarred && 'fill-red-500 text-red-500',
                )}
              />
            </Button>
          </SimpleTooltip>
        )}

        {showInfoButton && (
          <SimpleTooltip
            text={
              infoShown ? t('generic.hideDetails') : t('generic.showDetails')
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={onToggleInfo}
              className={cn(
                'size-9 shrink-0 rounded-full p-0 @[28rem]/actions:size-10',
                infoShown && 'text-primary',
              )}
            >
              <InfoIcon className="size-5" />
            </Button>
          </SimpleTooltip>
        )}
      </div>
    </div>
  )
}
