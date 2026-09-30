import merge from 'lodash/merge'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'
import { IThemeContext, Theme } from '@/types/themeContext'

export const useThemeStore = createWithEqualityFn<IThemeContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          theme: Theme.Black,
          setTheme: (theme: Theme) => {
            set((state) => {
              state.theme = theme
            })
          },
        })),
        {
          name: 'theme_store',
        },
      ),
      {
        name: 'theme_store',
        version: 1,
        // Theme.Black is the default, a theme picked
        // with the theme button is kept
        merge: (persistedState, currentState) => {
          const merged = merge(currentState, persistedState)

          // a stored theme that no longer exists falls back to the default
          if (!Object.values(Theme).includes(merged.theme)) {
            merged.theme = Theme.Black
          }

          return merged
        },
      },
    ),
  ),
)

export const useTheme = () => useThemeStore((state) => state)
