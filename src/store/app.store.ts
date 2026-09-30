import merge from 'lodash/merge'
import omit from 'lodash/omit'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import { pingServer } from '@/api/pingServer'
import { queryServerInfo } from '@/api/queryServerInfo'
import {
  AuthType,
  IAppContext,
  IServerConfig,
  PageViewType,
} from '@/types/serverConfig'
import { appConfig } from '@/utils/appConfig'
import { logger } from '@/utils/logger'
import { genEncodedPassword, genPasswordToken } from '@/utils/salt'

// Navidrome is reached through the backend of this container (/rest/*)
const serverUrl = window.location.origin

// Visible sections are set through the docker environment, not in the app
const sectionsFromConfig = {
  hideAlbumsSection: !appConfig.sidebar.albums,
  hideArtistsSection: !appConfig.sidebar.artists,
  hideGenresSection: !appConfig.sidebar.genres,
  hideFavoritesSection: !appConfig.features.favorites,
  hideRadiosSection: !appConfig.sidebar.radios,
  hidePlaylistsSection: !appConfig.features.playlists,
}

export const useAppStore = createWithEqualityFn<IAppContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set, get) => ({
          data: {
            isServerConfigured: false,
            osType: '',
            url: serverUrl,
            username: '',
            password: '',
            authType: AuthType.TOKEN,
            protocolVersion: '1.16.0',
            serverType: 'subsonic',
            logoutDialogState: false,
            songCount: null,
          },
          pages: {
            ...sectionsFromConfig,
            artistsPageViewType: 'grid',
            setArtistsPageViewType: (type) => {
              set((state) => {
                state.pages.artistsPageViewType = type
              })
            },
            isAllSectionsHidden: () => {
              const {
                hideAlbumsSection,
                hideArtistsSection,
                hideGenresSection,
                hideFavoritesSection,
                hideRadiosSection,
              } = get().pages

              return (
                hideAlbumsSection &&
                hideArtistsSection &&
                hideGenresSection &&
                hideFavoritesSection &&
                hideRadiosSection
              )
            },
          },
          actions: {
            setOsType: (value) => {
              set((state) => {
                state.data.osType = value
              })
            },
            setUrl: (value) => {
              set((state) => {
                state.data.url = value
              })
            },
            setUsername: (value) => {
              set((state) => {
                state.data.username = value
              })
            },
            setPassword: (value) => {
              set((state) => {
                state.data.password = value
              })
            },
            saveConfig: async ({ url, username, password }: IServerConfig) => {
              // try both token and password methods
              for (const authType of [AuthType.TOKEN, AuthType.PASSWORD]) {
                const token =
                  authType === AuthType.TOKEN
                    ? genPasswordToken(password)
                    : genEncodedPassword(password)

                const canConnect = await pingServer(
                  url,
                  username,
                  token,
                  authType,
                )

                const serverInfo = await queryServerInfo(url)

                if (canConnect) {
                  set((state) => {
                    state.data.url = url
                    state.data.username = username
                    state.data.password = token
                    state.data.authType = authType
                    state.data.protocolVersion = serverInfo.protocolVersion
                    state.data.serverType = serverInfo.serverType
                    state.data.isServerConfigured = true
                    state.data.extensionsSupported =
                      serverInfo.extensionsSupported
                  })
                  return true
                }
              }
              set((state) => {
                state.data.isServerConfigured = false
              })
              return false
            },
            removeConfig: () => {
              set((state) => {
                state.data.isServerConfigured = false
                state.data.osType = ''
                state.data.url = serverUrl
                state.data.username = ''
                state.data.password = ''
                state.data.authType = AuthType.TOKEN
                state.data.protocolVersion = '1.16.0'
                state.data.serverType = 'subsonic'
                state.data.songCount = null
                state.data.extensionsSupported = {}
                state.pages.artistsPageViewType = 'grid'
              })
            },
            setLogoutDialogState: (value) => {
              set((state) => {
                state.data.logoutDialogState = value
              })
            },
          },
        })),
        {
          name: 'app_store',
        },
      ),
      {
        name: 'app_store',
        version: 1,
        merge: (persistedState, currentState) => {
          try {
            // The container config always wins over values stored in the browser
            const fromConfig = {
              data: { url: serverUrl },
              pages: sectionsFromConfig,
            }

            return merge(currentState, persistedState ?? {}, fromConfig)
          } catch (error) {
            logger.error('[AppStore] [merge] - Unable to merge states', error)

            return currentState
          }
        },
        partialize: (state) => {
          const appStore = omit(state, 'data.logoutDialogState')

          return appStore
        },
      },
    ),
  ),
  shallow,
)

export const useAppData = () => useAppStore((state) => state.data)
export const useAppPages = () => useAppStore((state) => state.pages)
export const useAppActions = () => useAppStore((state) => state.actions)
export const useAppArtistsViewType = () =>
  useAppStore((state) => {
    const rawType = state.pages.artistsPageViewType
    const artistsPageViewType: PageViewType =
      rawType === 'table' ? 'table' : 'grid'
    const { setArtistsPageViewType } = state.pages

    const isTableView = artistsPageViewType === 'table'
    const isGridView = artistsPageViewType === 'grid'

    return {
      artistsPageViewType,
      setArtistsPageViewType,
      isTableView,
      isGridView,
    }
  })
