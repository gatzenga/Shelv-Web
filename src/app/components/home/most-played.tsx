import { useTranslation } from 'react-i18next'
import { PreviewListFallback } from '@/app/components/fallbacks/home-fallbacks'
import { useGetMostPlayed } from '@/app/hooks/use-home'
import PreviewList from './preview-list'

export function MostPlayed() {
  const { t } = useTranslation()
  const { data, isLoading } = useGetMostPlayed()

  if (isLoading) {
    return <PreviewListFallback />
  }

  if (!data || !data.list || data.list.length === 0) return null

  return <PreviewList title={t('home.mostPlayed')} list={data.list} />
}
