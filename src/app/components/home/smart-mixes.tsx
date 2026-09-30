import { Loader2, PlayIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { smartMixes, useSmartMix } from '@/app/hooks/use-smart-mix'
import { cn } from '@/lib/utils'

export function SmartMixes() {
  const { t } = useTranslation()
  const { loadingMix, playMix } = useSmartMix()

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4"
      data-testid="smart-mixes"
    >
      {smartMixes.map(({ type, icon: Icon }) => (
        <button
          key={type}
          type="button"
          disabled={loadingMix !== null}
          onClick={() => playMix(type)}
          className={cn(
            'flex items-center gap-2.5 rounded-full px-4 py-3.5',
            'bg-primary text-primary-foreground text-left',
            'transition-[filter] hover:brightness-95 active:brightness-90',
            'disabled:cursor-default disabled:opacity-90',
          )}
          data-testid={`smart-mix-${type}`}
        >
          <Icon className="w-5 h-5 mx-1 shrink-0" />
          <span className="font-bold truncate">{t(`home.mixes.${type}`)}</span>
          <span className="ml-auto shrink-0">
            {loadingMix === type ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-3.5 h-3.5 fill-current" />
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
