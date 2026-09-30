import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Theme } from '@/types/themeContext'

export function ThemePlaceholder({ theme }: { theme: Theme }) {
  return (
    <div className={theme}>
      <div className="bg-background aspect-square border border-border rounded overflow-hidden flex cursor-pointer">
        <div className="w-1/3 h-full bg-background border-r border-border flex flex-col p-1 gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-full h-1/5 bg-accent rounded-[2px]" />
          ))}
        </div>
        <div className="w-full h-full bg-background-foreground flex flex-col gap-1 p-1 *:w-full *:h-1/4 *:rounded-[2px]">
          <div className="bg-accent" />
          <div className="bg-primary" />
          <div className="bg-muted" />
          <div className="bg-secondary" />
        </div>
      </div>
    </div>
  )
}

type ThemeTitleProps = {
  isActive: boolean
  theme: Theme
}

export function ThemeTitle({ isActive, theme }: ThemeTitleProps) {
  const { t } = useTranslation()

  return (
    <span
      className={clsx(
        'mt-2 flex items-center gap-1.5 h-5 text-xs font-medium',
        isActive ? 'text-foreground' : 'text-muted-foreground/70',
      )}
    >
      {isActive && (
        <Check
          size={14}
          strokeWidth={2}
          className="shrink-0"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{t(`theme.${theme}`)}</span>
    </span>
  )
}
