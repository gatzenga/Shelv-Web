import {
  ChartColumnIcon,
  ClockIcon,
  ShuffleIcon,
  SparklesIcon,
} from 'lucide-react'
import { ComponentType, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { getBackendUrl } from '@/api/httpClient'
import { getLastFMOptions } from '@/store/lastfm-options.store'
import { usePlayerActions } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { logger } from '@/utils/logger'

export type SmartMix = 'newest' | 'frequent' | 'recent' | 'shuffle'

// Same mixes and icons as the Shelv app, the backend picks the songs
export const smartMixes: {
  type: SmartMix
  icon: ComponentType<{ className?: string }>
}[] = [
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

export function useSmartMix() {
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

  return { loadingMix, playMix }
}
