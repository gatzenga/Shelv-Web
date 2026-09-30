import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MainSidebarMenuButton } from '@/app/components/ui/main-sidebar'
import { useRouteIsActive } from '@/app/hooks/use-route-is-active'
import { ISidebarItem } from '@/app/layout/sidebar'
import { scrollPageToTop } from '@/utils/scrollPageToTop'

export function SidebarMainItem({ item }: { item: ISidebarItem }) {
  const { t } = useTranslation()
  const { isActive } = useRouteIsActive()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <MainSidebarMenuButton
      asChild
      tooltip={t(item.title)}
      className={clsx(
        isActive(item.route) &&
          'bg-primary/15 font-semibold text-primary hover:bg-primary/20 hover:text-primary',
      )}
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
        <item.icon />
        {t(item.title)}
      </Link>
    </MainSidebarMenuButton>
  )
}
