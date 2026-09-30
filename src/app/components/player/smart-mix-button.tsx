import {
  ChartColumnIcon,
  ClockIcon,
  Loader2,
  ShuffleIcon,
  SparklesIcon,
} from 'lucide-react'
import { ComponentType, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { getBackendUrl } from '@/api/httpClient'
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
import { getLastFMOptions } from '@/store/lastfm-options.store'
import { usePlayerActions } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { logger } from '@/utils/logger'

type SmartMix = 'newest' | 'frequent' | 'recent' | 'shuffle'

// Same mixes and icons as the Shelv player, the backend picks the songs
const mixes: { type: SmartMix; icon: ComponentType<{ className?: string }> }[] =
  [
    { type: 'newest', icon: SparklesIcon },
    { type: 'frequent', icon: ChartColumnIcon },
    { type: 'recent', icon: ClockIcon },
    { type: 'shuffle', icon: ShuffleIcon },
  ]

async function loadMix(type: SmartMix) {
  const { mixes } = getLastFMOptions()
  const response = await fetch(
    getBackendUrl('/api/mix', { type, mixes: String(mixes) }),
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error(`smart mix failed: ${response.status}`)

  const { songs } = (await response.json()) as { songs: ISong[] }
  return songs
}

export function PlayerSmartMixButton() {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()
  const [loadingMix, setLoadingMix] = useState<SmartMix | null>(null)

  async function playMix(type: SmartMix) {
    if (loadingMix) return
    setLoadingMix(type)

    try {
      const songs = await loadMix(type)

      if (songs.length === 0) {
        toast.info(t('smartMix.empty'))
        return
      }

      setSongList(songs, 0, false, {
        id: `smart-mix-${type}`,
        name: t(`smartMix.${type}`),
        type: 'songs',
      })
    } catch (error) {
      logger.error('[SmartMix] loading failed', error)
      toast.error(t('smartMix.error'))
    } finally {
      setLoadingMix(null)
    }
  }

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
        {mixes.map(({ type, icon: Icon }) => (
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
