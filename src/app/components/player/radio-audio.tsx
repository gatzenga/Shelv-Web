import type Hls from 'hls.js'
import {
  ComponentPropsWithoutRef,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { isIOS, isSafari } from 'react-device-detect'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { radios } from '@/service/radios'
import { usePlayerActions, usePlayerIsPlaying } from '@/store/player.store'
import { useRadioPlaybackStore } from '@/store/radio-playback.store'
import { Radio } from '@/types/responses/radios'
import { logger } from '@/utils/logger'

type RadioAudioProps = Omit<ComponentPropsWithoutRef<'audio'>, 'src'> & {
  radio: Radio
  audioRef: RefObject<HTMLAudioElement>
}

// Shelv: up to 5 reconnects, waiting 1, 2, 4, 8, 16 seconds (max 30)
const maxReconnectAttempts = 5
// Buffering longer than this counts as a dead stream
const stallTimeout = 15000

// Safari on macOS and every browser on iOS play HLS with Apple's own player,
// the reference implementation. Everywhere else hls.js is used, because the
// native HLS support of other browsers (e.g. recent Chrome) is not reliable
// for live audio.
function usesNativeHls(audio: HTMLAudioElement) {
  const canPlayNative =
    audio.canPlayType('application/vnd.apple.mpegurl') !== ''

  return canPlayNative && (isSafari || isIOS)
}

function detachSource(audio: HTMLAudioElement) {
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

// Plays a radio station through the backend (/api/radio/stream).
// Pausing stops the stream, playing again reconnects to the live edge,
// like the Shelv player does.
export function RadioAudio({ radio, audioRef, ...props }: RadioAudioProps) {
  const { t } = useTranslation()
  const isPlaying = usePlayerIsPlaying()
  const { setPlayingState } = usePlayerActions()
  const setBuffering = useRadioPlaybackStore((state) => state.setBuffering)
  const [connection, setConnection] = useState(0)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const stationId = radio.id

  const cancelReconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = undefined
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return

    if (attemptsRef.current >= maxReconnectAttempts) {
      logger.error('[Radio] giving up after reconnect attempts', { stationId })
      setBuffering(false)
      setPlayingState(false)
      toast.error(t('radios.unreachable'))
      return
    }

    const delay = Math.min(2 ** attemptsRef.current, 30) * 1000
    logger.info('[Radio] reconnecting', {
      attempt: attemptsRef.current + 1,
      delay,
    })
    setBuffering(true)

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = undefined
      attemptsRef.current += 1
      setConnection((value) => value + 1)
    }, delay)
  }, [setBuffering, setPlayingState, stationId, t])

  // A new station or pressing play starts with fresh reconnect attempts
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on station and play state
  useEffect(() => {
    attemptsRef.current = 0
    cancelReconnect()
  }, [stationId, isPlaying, cancelReconnect])

  useEffect(() => cancelReconnect, [cancelReconnect])

  // biome-ignore lint/correctness/useExhaustiveDependencies: connection triggers a reconnect
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!isPlaying) {
      detachSource(audio)
      setBuffering(false)
      return
    }

    let isActive = true
    let hls: Hls | null = null
    let hasRecoveredMediaError = false
    let stallTimer: ReturnType<typeof setTimeout> | undefined
    const streamUrl = radios.getStreamUrl(stationId)

    const clearStall = () => clearTimeout(stallTimer)

    const onPlaying = () => {
      attemptsRef.current = 0
      clearStall()
      setBuffering(false)
    }
    // audio keeps moving, so any pending stall is over
    const onProgress = () => {
      if (audio.paused) return
      clearStall()
      setBuffering(false)
    }
    const onWaiting = () => {
      setBuffering(true)
      clearStall()
      stallTimer = setTimeout(scheduleReconnect, stallTimeout)
    }
    // A live stream never ends on its own, so ended and errors reconnect
    const onFailure = () => {
      if (isActive) scheduleReconnect()
    }
    // Paused from outside the app, e.g. by the system during a phone call
    const onPause = () => {
      // A dropped stream also fires pause (right before ended/error),
      // that case reconnects instead of stopping
      if (!isActive || audio.ended || audio.error) return
      setPlayingState(false)
    }

    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('timeupdate', onProgress)
    audio.addEventListener('error', onFailure)
    audio.addEventListener('ended', onFailure)
    audio.addEventListener('pause', onPause)

    async function play() {
      try {
        await audio?.play()
      } catch (error) {
        if (!isActive) return
        const name = error instanceof Error ? error.name : ''

        // Autoplay policy: the browser wants a click, reconnecting will not help
        if (name === 'NotAllowedError') {
          setBuffering(false)
          setPlayingState(false)
          return
        }
        if (name === 'AbortError') return

        logger.error('[Radio] play failed', error)
        scheduleReconnect()
      }
    }

    async function start() {
      if (!audio) return
      setBuffering(true)

      const kind = await radios.getStreamKind(stationId).catch(() => 'direct')
      if (!isActive) return

      if (kind === 'hls' && !usesNativeHls(audio)) {
        const { default: HlsPlayer } = await import('hls.js')
        if (!isActive) return

        if (HlsPlayer.isSupported()) {
          const player = new HlsPlayer({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
            // start three segments behind the live edge, enough for jitter
            liveSyncDurationCount: 3,
          })
          hls = player

          player.on(HlsPlayer.Events.ERROR, (_, data) => {
            if (!data.fatal || !isActive) return

            // hls.js docs: a fatal media error can be recovered once in place
            if (
              data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR &&
              !hasRecoveredMediaError
            ) {
              hasRecoveredMediaError = true
              player.recoverMediaError()
              return
            }

            logger.error('[Radio] fatal HLS error', data.details)
            scheduleReconnect()
          })

          player.loadSource(streamUrl)
          player.attachMedia(audio)
          await play()
          return
        }
      }

      // Native playback: direct streams everywhere, HLS on Apple devices
      audio.src = streamUrl
      await play()
    }

    start()

    return () => {
      isActive = false
      clearStall()
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('timeupdate', onProgress)
      audio.removeEventListener('error', onFailure)
      audio.removeEventListener('ended', onFailure)
      audio.removeEventListener('pause', onPause)
      hls?.destroy()
      detachSource(audio)
    }
  }, [audioRef, isPlaying, stationId, connection])

  return <audio ref={audioRef} preload="none" {...props} />
}
