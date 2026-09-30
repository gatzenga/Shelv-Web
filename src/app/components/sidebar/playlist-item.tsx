import clsx from 'clsx'
import { ListMusic } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router-dom'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { PlaylistOptions } from '@/app/components/playlist/options'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import {
  MainSidebarMenuButton,
  MainSidebarMenuItem,
} from '@/app/components/ui/main-sidebar'
import { useRouteIsActive } from '@/app/hooks/use-route-is-active'
import { ROUTES } from '@/routes/routesList'
import { useIsPlaylistPlaying } from '@/store/player.store'
import { Playlist } from '@/types/responses/playlist'
import { scrollPageToTop } from '@/utils/scrollPageToTop'

const MemoContextMenuProvider = memo(ContextMenuProvider)
const MemoPlaylistOptions = memo(PlaylistOptions)

interface SidebarPlaylistItemProps {
  playlist: Playlist
  // what is shown, the name without its folders
  title?: string
  depth?: number
}

export function SidebarPlaylistItem({
  playlist,
  title,
  depth = 0,
}: SidebarPlaylistItemProps) {
  const { isOnPlaylist } = useRouteIsActive()
  const { isPlaylistPlaying } = useIsPlaylistPlaying(playlist.id)

  return (
    <MainSidebarMenuItem>
      <MemoContextMenuProvider
        options={
          <MemoPlaylistOptions
            variant="context"
            playlist={playlist}
            showPlay={true}
          />
        }
      >
        <MainSidebarMenuButton
          asChild
          style={depth > 0 ? { paddingLeft: `${8 + depth * 14}px` } : undefined}
          className={clsx(
            isOnPlaylist(playlist.id) && 'cursor-default',
            isOnPlaylist(playlist.id) && !isPlaylistPlaying && 'bg-accent',
            isPlaylistPlaying && 'text-primary hover:text-primary',
          )}
        >
          <Link
            to={ROUTES.PLAYLIST.PAGE(playlist.id)}
            onClick={(e) => {
              if (isOnPlaylist(playlist.id)) {
                e.preventDefault()
                scrollPageToTop()
              }
            }}
          >
            {isPlaylistPlaying ? (
              <EqualizerBars className="text-primary mb-1" />
            ) : (
              <ListMusic />
            )}
            <span className="truncate">{title ?? playlist.name}</span>
          </Link>
        </MainSidebarMenuButton>
      </MemoContextMenuProvider>
    </MainSidebarMenuItem>
  )
}
