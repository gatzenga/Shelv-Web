import { ChevronRightIcon, FolderIcon } from 'lucide-react'
import {
  MainSidebarMenuButton,
  MainSidebarMenuItem,
} from '@/app/components/ui/main-sidebar'
import { cn } from '@/lib/utils'
import { PlaylistFolderNode } from '@/utils/playlistFolders'

interface SidebarPlaylistFolderProps {
  folder: PlaylistFolderNode
  depth: number
  isOpen: boolean
  onToggle: () => void
}

// A folder of playlists, opens and closes in place
export function SidebarPlaylistFolder({
  folder,
  depth,
  isOpen,
  onToggle,
}: SidebarPlaylistFolderProps) {
  return (
    <MainSidebarMenuItem>
      <MainSidebarMenuButton
        onClick={onToggle}
        aria-expanded={isOpen}
        style={depth > 0 ? { paddingLeft: `${8 + depth * 14}px` } : undefined}
        data-testid="playlist-folder"
      >
        <FolderIcon />
        <span className="truncate">{folder.name}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {folder.count}
        </span>
        <ChevronRightIcon
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-90',
          )}
        />
      </MainSidebarMenuButton>
    </MainSidebarMenuItem>
  )
}
