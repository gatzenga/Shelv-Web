import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { subsonic } from '@/service/subsonic'
import { logger } from '@/utils/logger'

// Copies a public link to a song or an album to the clipboard
export function useShare() {
  const { t } = useTranslation()

  async function share(id: string) {
    try {
      const url = await subsonic.share.createShare(id)
      if (!url) throw new Error('no share link')

      await navigator.clipboard.writeText(url)
      toast.success(t('share.copied'))
    } catch (error) {
      logger.error('[Share] failed', error)
      toast.error(t('share.failed'))
    }
  }

  return { share }
}
