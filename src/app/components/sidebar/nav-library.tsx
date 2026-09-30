import {
  MainSidebarGroup,
  MainSidebarMenu,
  MainSidebarMenuItem,
} from '@/app/components/ui/main-sidebar'
import { libraryItems, SidebarItems } from '@/app/layout/sidebar'
import { useAppStore } from '@/store/app.store'
import { SidebarMainItem } from './main-item'

export function NavLibrary() {
  const hideAlbumsSection = useAppStore().pages.hideAlbumsSection
  const hideArtistsSection = useAppStore().pages.hideArtistsSection
  const hideGenresSection = useAppStore().pages.hideGenresSection
  const hideFavoritesSection = useAppStore().pages.hideFavoritesSection
  const hideRadiosSection = useAppStore().pages.hideRadiosSection

  return (
    <MainSidebarGroup className="px-4 py-0">
      <MainSidebarMenu>
        {libraryItems.map((item) => {
          // Settings to show/hide library sections
          if (hideAlbumsSection && item.id === SidebarItems.Albums) return null
          if (hideArtistsSection && item.id === SidebarItems.Artists)
            return null
          if (hideGenresSection && item.id === SidebarItems.Genres) return null
          if (hideFavoritesSection && item.id === SidebarItems.Favorites)
            return null
          if (hideRadiosSection && item.id === SidebarItems.Radios) return null

          return (
            <MainSidebarMenuItem key={item.id}>
              <SidebarMainItem item={item} />
            </MainSidebarMenuItem>
          )
        })}
      </MainSidebarMenu>
    </MainSidebarGroup>
  )
}
