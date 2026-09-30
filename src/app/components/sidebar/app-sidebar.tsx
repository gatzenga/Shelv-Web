import {
  MainSidebar,
  MainSidebarContent,
} from '@/app/components/ui/main-sidebar'
import { MobileCloseButton } from './mobile-close-button'
import { NavLibrary } from './nav-library'
import { NavMain } from './nav-main'
import { NavPlaylists } from './nav-playlists'
import { SearchHotkeys } from './search-hotkeys'

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof MainSidebar>) {
  return (
    <MainSidebar collapsible="icon" {...props}>
      <MobileCloseButton />
      <SearchHotkeys />
      <NavMain />
      <MainSidebarContent className="max-h-fit flex-none overflow-x-clip mb-2">
        <NavLibrary />
      </MainSidebarContent>
      <NavPlaylists />
    </MainSidebar>
  )
}
