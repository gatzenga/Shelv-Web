import {
  MainSidebarGroup,
  MainSidebarMenu,
  MainSidebarMenuItem,
} from '@/app/components/ui/main-sidebar'
import { mainNavItems } from '@/app/layout/sidebar'
import { SidebarMainItem } from './main-item'

export function NavMain() {
  return (
    <MainSidebarGroup className="px-4 pb-1 group-data-[collapsible=icon]:py-1">
      <MainSidebarMenu>
        {mainNavItems.map((item) => (
          <MainSidebarMenuItem key={item.id}>
            <SidebarMainItem item={item} />
          </MainSidebarMenuItem>
        ))}
      </MainSidebarMenu>
    </MainSidebarGroup>
  )
}
