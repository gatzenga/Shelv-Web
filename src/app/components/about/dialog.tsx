import { GlobeIcon, MailIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppIcon } from '@/app/components/app-icon'
import { DiscordIcon, GitHubIcon } from '@/app/components/icons/brand-icons'
import { MultiBadge } from '@/app/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AboutLink, aboutLinks } from '@/utils/appLinks'
import { getAppInfo } from '@/utils/appName'

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Same look as the buttons on vkugler.app: one size, brand colors
const linkStyles: Record<AboutLink, { className: string; icon: ReactNode }> = {
  coffee: {
    className: 'bg-[#72a4f2] text-white',
    icon: <img src="/kofi-cup.png" alt="" className="size-6 object-contain" />,
  },
  github: {
    className: 'bg-white text-[#24292f]',
    icon: <GitHubIcon className="size-5" />,
  },
  discord: {
    className: 'bg-[#5865f2] text-white',
    icon: <DiscordIcon className="size-5" />,
  },
  website: {
    className: 'bg-secondary text-secondary-foreground',
    icon: <GlobeIcon className="size-5" />,
  },
  contact: {
    className: 'bg-secondary text-secondary-foreground',
    icon: <MailIcon className="size-5" />,
  },
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t } = useTranslation()
  const { name, version } = getAppInfo()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 cursor-default"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('menu.about')}</DialogTitle>
        <DialogHeader>
          <div className="flex gap-2 items-center justify-start w-full py-4 px-6 bg-background-foreground border-b border-border">
            <AppIcon className="size-8" />
            <h1 className="font-medium text-lg">{name}</h1>
          </div>
        </DialogHeader>

        <div className="w-full p-6 gap-6 flex flex-col">
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-medium">{t('about.client')}</span>
            <div className="flex gap-2">
              <MultiBadge label={t('about.version')}>{version}</MultiBadge>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {aboutLinks.map(({ key, url }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'flex h-11 w-full items-center justify-center gap-2.5 rounded-lg px-4',
                  'text-sm font-bold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                  'transition-transform hover:-translate-y-0.5',
                  linkStyles[key].className,
                )}
              >
                {linkStyles[key].icon}
                {t(`about.links.${key}`)}
              </a>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
