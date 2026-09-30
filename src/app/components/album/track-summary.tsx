import { useTranslation } from 'react-i18next'
import { ISong } from '@/types/responses/song'

interface TrackSummaryProps {
  songs: ISong[]
  // The length the server reports for the album, preferred to the sum
  duration?: number
}

// "38 tracks · 2 hr 30 min", below the last track like in the Shelv app
export function TrackSummary({ songs, duration }: TrackSummaryProps) {
  const { t } = useTranslation()

  const summed = songs.reduce((total, song) => total + (song.duration ?? 0), 0)
  const seconds = duration && duration > 0 ? duration : summed

  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  function formatDuration() {
    if (hours > 0 && minutes > 0) {
      return t('album.summary.hoursMinutes', { hours, minutes })
    }
    if (hours > 0) return t('album.summary.hours', { hours })

    return t('album.summary.minutes', { minutes })
  }

  const count = t('album.summary.tracks', { count: songs.length })

  return (
    <p className="px-8 pt-2 pb-6 text-sm text-muted-foreground tabular-nums">
      {seconds > 0 ? `${count} · ${formatDuration()}` : count}
    </p>
  )
}
