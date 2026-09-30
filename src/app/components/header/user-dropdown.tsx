import { Info, LogOut, Radio, User } from 'lucide-react'
import { useState } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'

import { AboutDialog } from '@/app/components/about/dialog'
import { LastFMDialog } from '@/app/components/lastfm/dialog'
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { LogoutObserver } from '@/app/observers/logout-observer'
import { logoutKeys, stringifyShortcut } from '@/shortcuts'
import { useAppData, useAppStore } from '@/store/app.store'

export function UserDropdown() {
  const { username, url } = useAppData()
  const setLogoutDialogState = useAppStore(
    (state) => state.actions.setLogoutDialogState,
  )
  const { t } = useTranslation()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [lastfmOpen, setLastfmOpen] = useState(false)

  useHotkeys('shift+ctrl+q', () => setLogoutDialogState(true))

  return (
    <Fragment>
      <LogoutObserver />

      <LastFMDialog open={lastfmOpen} onOpenChange={setLastfmOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      <DropdownMenu>
        <DropdownMenuTrigger className="user-dropdown-trigger">
          <Avatar className="w-8 h-8 rounded-full cursor-pointer">
            <AvatarFallback className="text-sm bg-transparent hover:bg-accent">
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2">
              <p className="text-sm font-medium leading-none">{username}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {url}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLastfmOpen(true)}>
            <Radio className="mr-2 h-4 w-4" />
            <span>{t('menu.lastfm')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Info className="mr-2 h-4 w-4" />
            <span>{t('menu.about')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLogoutDialogState(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('menu.serverLogout')}</span>
            <DropdownMenuShortcut>
              {stringifyShortcut(logoutKeys)}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Fragment>
  )
}
