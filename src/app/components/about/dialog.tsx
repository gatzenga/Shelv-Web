import { useTranslation } from 'react-i18next'
import { AppIcon } from '@/app/components/app-icon'
import { MultiBadge } from '@/app/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { aboutLinks } from '@/utils/appLinks'
import { getAppInfo } from '@/utils/appName'

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {aboutLinks.map(({ key, url }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary hover:underline"
              >
                {t(`about.links.${key}`)}
              </a>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
