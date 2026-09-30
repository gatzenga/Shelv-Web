import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyPlaylistsMessage } from '@/app/components/playlist/empty-message'
import { SidebarPlaylistButtons } from '@/app/components/playlist/sidebar-buttons'
import {
  MainSidebarContent,
  MainSidebarGroupLabel,
  MainSidebarMenu,
} from '@/app/components/ui/main-sidebar'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { usePersistedState } from '@/app/hooks/use-persisted-state'
import { subsonic } from '@/service/subsonic'
import { useAppStore } from '@/store/app.store'
import { buildPlaylistTree, PlaylistNode } from '@/utils/playlistFolders'
import { queryKeys } from '@/utils/queryKeys'
import { SidebarPlaylistFolder } from './playlist-folder'
import { SidebarPlaylistItem } from './playlist-item'

export function NavPlaylists() {
  const { t } = useTranslation()
  const hidePlaylistsSection = useAppStore().pages.hidePlaylistsSection

  const { data: playlists } = useQuery({
    queryKey: [queryKeys.playlist.all],
    queryFn: subsonic.playlists.getAll,
  })

  // the paths of the open folders
  const [openFolders, setOpenFolders] = usePersistedState<string>(
    'playlist-folders-open',
    '[]',
    (value): value is string => typeof value === 'string',
  )
  const tree = useMemo(() => buildPlaylistTree(playlists ?? []), [playlists])

  if (hidePlaylistsSection) return null

  const open = new Set<string>(safeParse(openFolders))

  function toggleFolder(id: string) {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)

    setOpenFolders(JSON.stringify([...next]))
  }

  function renderNodes(nodes: PlaylistNode[], depth: number) {
    return nodes.map((node) => {
      if (node.type === 'playlist') {
        return (
          <SidebarPlaylistItem
            key={node.playlist.id}
            playlist={node.playlist}
            title={node.title}
            depth={depth}
          />
        )
      }

      return (
        <Fragment key={`folder-${node.id}`}>
          <SidebarPlaylistFolder
            folder={node}
            depth={depth}
            isOpen={open.has(node.id)}
            onToggle={() => toggleFolder(node.id)}
          />
          {open.has(node.id) && renderNodes(node.children, depth + 1)}
        </Fragment>
      )
    })
  }

  const hasPlaylists = playlists !== undefined && playlists.length > 0

  return (
    <>
      <div
        className={clsx(
          'flex items-center justify-between px-4 overflow-x-clip',
          'transition-opacity group-data-[collapsible=icon]:opacity-0',
          'group-data-[collapsible=icon]:pointer-events-none',
        )}
      >
        <MainSidebarGroupLabel>{t('sidebar.playlists')}</MainSidebarGroupLabel>

        <SidebarPlaylistButtons />
      </div>
      <MainSidebarContent
        className={clsx(
          'flex pl-4 h-full overflow-x-clip transition-[margin,opacity]',
          'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
          'group-data-[collapsible=icon]:pointer-events-none',
        )}
      >
        <ScrollArea className="pb-4">
          <MainSidebarMenu className="pr-4">
            {hasPlaylists && renderNodes(tree, 0)}

            {!hasPlaylists && <EmptyPlaylistsMessage />}
          </MainSidebarMenu>
        </ScrollArea>
      </MainSidebarContent>
    </>
  )
}

function safeParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string')
      : []
  } catch {
    return []
  }
}
