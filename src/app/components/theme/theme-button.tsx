import { Palette } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/app/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { appThemes } from '@/app/observers/theme-observer'
import { useTheme } from '@/store/theme.store'
import { ThemePlaceholder, ThemeTitle } from './theme-preview'

export function ThemeButton() {
  const { t } = useTranslation()
  const { theme: currentTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SimpleTooltip text={t('theme.label')} side="bottom">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md"
            data-testid="theme-button"
          >
            <Palette className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent
        align="end"
        className="w-[24rem] max-w-[calc(100vw-2rem)] p-3"
      >
        <div className="grid grid-cols-3 gap-3">
          {appThemes.map((theme) => (
            <button
              key={theme}
              type="button"
              className="text-left w-full flex flex-col group cursor-pointer"
              onClick={() => {
                setTheme(theme)
                setOpen(false)
              }}
            >
              <ThemePlaceholder theme={theme} />
              <ThemeTitle theme={theme} isActive={theme === currentTheme} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
