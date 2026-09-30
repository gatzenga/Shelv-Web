import { memo } from 'react'
import { Player } from '@/app/components/player/player'
import { CreatePlaylistDialog } from '@/app/components/playlist/form-dialog'
import { RemovePlaylistDialog } from '@/app/components/playlist/remove-dialog'
import { SidePanel } from '@/app/components/side-panel/side-panel'
import { AppSidebar } from '@/app/components/sidebar/app-sidebar'
import { SongInfoDialog } from '@/app/components/song/info-dialog'
import {
  MainSidebarInset,
  MainSidebarProvider,
} from '@/app/components/ui/main-sidebar'
import { Header } from '@/app/layout/header'
import { MainRoutes } from './main'

const MemoHeader = memo(Header)
const MemoPlayer = memo(Player)
const MemoSongInfoDialog = memo(SongInfoDialog)
const MemoRemovePlaylistDialog = memo(RemovePlaylistDialog)

export default function BaseLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <MainSidebarProvider>
        <MemoHeader />
        <AppSidebar />
        <MainSidebarInset>
          <MainRoutes />
        </MainSidebarInset>
        <SidePanel />
        <MemoPlayer />
      </MainSidebarProvider>
      <MemoSongInfoDialog />
      <MemoRemovePlaylistDialog />
      <CreatePlaylistDialog />
    </div>
  )
}
