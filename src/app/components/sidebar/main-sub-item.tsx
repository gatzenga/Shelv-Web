import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  MainSidebarMenuSubButton,
  MainSidebarMenuSubItem,
} from '@/app/components/ui/main-sidebar'
import { useRouteIsActive } from '@/app/hooks/use-route-is-active'
import { ISidebarItem } from '@/app/layout/sidebar'
import { scrollPageToTop } from '@/utils/scrollPageToTop'

export function SidebarMainSubItem({ item }: { item: ISidebarItem }) {
  const { t } = useTranslation()
  const { isActive } = useRouteIsActive()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <MainSidebarMenuSubItem>
      <MainSidebarMenuSubButton
        asChild
        className={clsx(isActive(item.route) && 'bg-accent')}
      >
        <Link
          to={item.route}
          onClick={(e) => {
            scrollPageToTop()
            if (location.pathname === item.route && location.search) {
              e.preventDefault()
              navigate(item.route)
            }
          }}
        >
          {t(item.title)}
        </Link>
      </MainSidebarMenuSubButton>
    </MainSidebarMenuSubItem>
  )
}
