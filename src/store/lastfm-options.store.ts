import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { appConfig } from '@/utils/appConfig'

interface LastFMOptionsState {
  topSongs: boolean | null
  mixes: boolean | null
  setTopSongs: (value: boolean) => void
  setMixes: (value: boolean) => void
}

// null means the browser never chose, the container default applies then.
// A choice is kept in this browser, a new browser or a private tab starts
// with the default again.
export const useLastFMOptions = create<LastFMOptionsState>()(
  persist(
    (set) => ({
      topSongs: null,
      mixes: null,
      setTopSongs: (value) => set({ topSongs: value }),
      setMixes: (value) => set({ mixes: value }),
    }),
    {
      name: 'lastfm_options',
      partialize: (state) => ({
        topSongs: state.topSongs,
        mixes: state.mixes,
      }),
    },
  ),
)

export const useLastFMTopSongs = () =>
  useLastFMOptions(
    (state) => state.topSongs ?? appConfig.lastfmDefaults.topSongs,
  )

export const useLastFMMixes = () =>
  useLastFMOptions((state) => state.mixes ?? appConfig.lastfmDefaults.mixes)

export function getLastFMOptions() {
  const { topSongs, mixes } = useLastFMOptions.getState()

  return {
    topSongs: topSongs ?? appConfig.lastfmDefaults.topSongs,
    mixes: mixes ?? appConfig.lastfmDefaults.mixes,
  }
}
