import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import { RadioNowPlaying } from '@/types/responses/radios'

// Live state of the playing station. Not persisted: it is only valid
// while the stream runs.
interface RadioPlaybackState {
  stationId: string | null
  nowPlaying: RadioNowPlaying | null
  // the audio element is (re)connecting to the stream
  isBuffering: boolean
  // no now playing response arrived yet for this station
  isMetadataConnecting: boolean
  setBuffering: (value: boolean) => void
  setNowPlaying: (value: RadioNowPlaying) => void
  setMetadataConnecting: (value: boolean) => void
  startStation: (stationId: string | null) => void
}

export const useRadioPlaybackStore = createWithEqualityFn<RadioPlaybackState>()(
  (set) => ({
    stationId: null,
    nowPlaying: null,
    isBuffering: false,
    isMetadataConnecting: false,
    setBuffering: (isBuffering) => set({ isBuffering }),
    setNowPlaying: (nowPlaying) =>
      set({ nowPlaying, isMetadataConnecting: false }),
    setMetadataConnecting: (isMetadataConnecting) =>
      set({ isMetadataConnecting }),
    // Shelv: a new station starts with only its name, the same station keeps
    // what it already shows
    startStation: (stationId) =>
      set((state) =>
        state.stationId === stationId
          ? state
          : {
              stationId,
              nowPlaying: null,
              isMetadataConnecting: stationId !== null,
            },
      ),
  }),
  shallow,
)

export const useRadioNowPlayingState = () =>
  useRadioPlaybackStore((state) => ({
    nowPlaying: state.nowPlaying,
    // Shelv: isRadioConnecting
    isConnecting:
      state.isBuffering ||
      state.isMetadataConnecting ||
      (state.nowPlaying !== null && !state.nowPlaying.isOnline),
  }))
