import { Loader2, SparklesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { smartMixes, useSmartMix } from '@/app/hooks/use-smart-mix'

export function PlayerSmartMixButton() {
  const { t } = useTranslation()
  const { loadingMix, playMix } = useSmartMix()

  return (
    <DropdownMenu>
      <SimpleTooltip text={t('smartMix.label')}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-10 h-10 p-2 text-secondary-foreground"
            data-testid="player-smart-mix-button"
          >
            {loadingMix ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SparklesIcon className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </SimpleTooltip>
      <DropdownMenuContent align="end" side="top" className="min-w-52">
        <DropdownMenuLabel className="text-muted-foreground font-medium">
          {t('smartMix.label')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {smartMixes.map(({ type, icon: Icon }) => (
          <DropdownMenuItem
            key={type}
            disabled={loadingMix !== null}
            onClick={() => playMix(type)}
            className="cursor-pointer"
          >
            <Icon className="mr-2 w-4 h-4" />
            <span>{t(`smartMix.${type}`)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
