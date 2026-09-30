import {
  ComponentPropsWithoutRef,
  RefObject,
  useCallback,
  useEffect,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { usePlayerIsPlaying, usePlayerMediaType } from '@/store/player.store'
import { logger } from '@/utils/logger'

type AudioPlayerProps = ComponentPropsWithoutRef<'audio'> & {
  audioRef: RefObject<HTMLAudioElement>
}

export function AudioPlayer({ audioRef, ...props }: AudioPlayerProps) {
  const { t } = useTranslation()
  const { isSong } = usePlayerMediaType()
  const isPlaying = usePlayerIsPlaying()

  const handleSongError = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    logger.error('Audio load error', {
      src: audio.src,
      networkState: audio.networkState,
      readyState: audio.readyState,
      error: audio.error,
    })

    toast.error(t('warnings.songError'))
  }, [audioRef, t])

  useEffect(() => {
    async function handleSong() {
      const audio = audioRef.current
      if (!audio) return

      try {
        if (isPlaying) {
          await audio.play()
        } else {
          audio.pause()
        }
      } catch (error) {
        logger.error('Audio playback failed', error)
        handleSongError()
      }
    }
    if (isSong) handleSong()
  }, [audioRef, handleSongError, isPlaying, isSong])

  return <audio ref={audioRef} {...props} onError={handleSongError} />
}
