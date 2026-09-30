import { useEffect } from 'react'
import { radios } from '@/service/radios'
import { useRadioPlaybackStore } from '@/store/radio-playback.store'
import { Radio } from '@/types/responses/radios'
import { resolveNowPlaying } from '@/utils/radioMetadata'

const defaultInterval = 30000

// Polls the now playing metadata of the current station like the Shelv
// player: AzuraCast/SUB/WAVE every 3 seconds on a fixed cadence, ICY every
// 30 seconds after the previous request finished.
export function useRadioNowPlaying(radio: Radio | undefined) {
  const stationId = radio?.id

  useEffect(() => {
    const store = useRadioPlaybackStore.getState()
    store.startStation(stationId ?? null)

    if (!stationId) return

    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let nextCycle = Date.now()
    // a failed request keeps the cadence of the last known source
    let interval = defaultInterval
    let isFixedCadence = false

    async function poll() {
      try {
        const incoming = await radios.getNowPlaying(
          stationId as string,
          controller.signal,
        )
        if (controller.signal.aborted) return

        if (incoming) {
          interval = incoming.pollInterval
          isFixedCadence = incoming.source === 'azuracast'
        }

        if (incoming?.available) {
          const { nowPlaying, setNowPlaying } = useRadioPlaybackStore.getState()
          const resolved = resolveNowPlaying(nowPlaying, incoming)

          if (JSON.stringify(resolved) !== JSON.stringify(nowPlaying)) {
            setNowPlaying(resolved)
          }
        } else {
          // Shelv: still connecting as long as nothing is shown
          const { nowPlaying, setMetadataConnecting } =
            useRadioPlaybackStore.getState()
          setMetadataConnecting(!nowPlaying?.title && !nowPlaying?.artist)
        }
      } catch {
        if (controller.signal.aborted) return
      }

      let delay = interval

      if (isFixedCadence) {
        do {
          nextCycle += interval
        } while (nextCycle <= Date.now())
        delay = nextCycle - Date.now()
      }

      timer = setTimeout(poll, delay)
    }

    poll()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [stationId])
}
