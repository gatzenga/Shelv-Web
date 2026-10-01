// Configuration of the container, set through the docker environment.
// The backend delivers it with /env-config.js before the app starts
// (see server/config.ts). The defaults apply when there is no backend.

export type AppLanguage = 'de' | 'en'

export type DiscoverSection =
  | 'smart-mixes'
  | 'recently-added'
  | 'recently-played'
  | 'frequently-played'
  | 'random-albums'

export interface AppConfig {
  language: AppLanguage
  lyrics: boolean
  discoverSections: DiscoverSection[]
  lastfmDefaults: {
    topSongs: boolean
    mixes: boolean
  }
  sidebar: {
    albums: boolean
    artists: boolean
    genres: boolean
    radios: boolean
  }
  features: {
    favorites: boolean
    playlists: boolean
  }
  infinityMix: {
    songsToAdd: number
    matchCurrentSong: boolean
  }
  scrobbleCount: number
  shareBaseUrl: string | null
}

const defaultConfig: AppConfig = {
  language: 'de',
  lyrics: false,
  discoverSections: [
    'smart-mixes',
    'recently-added',
    'recently-played',
    'frequently-played',
    'random-albums',
  ],
  lastfmDefaults: {
    topSongs: true,
    mixes: true,
  },
  sidebar: {
    albums: true,
    artists: true,
    genres: true,
    radios: true,
  },
  features: {
    favorites: true,
    playlists: true,
  },
  infinityMix: {
    songsToAdd: 5,
    matchCurrentSong: true,
  },
  scrobbleCount: 30,
  shareBaseUrl: null,
}

function loadAppConfig(): AppConfig {
  const config = window.APP_CONFIG

  if (!config) return defaultConfig

  return {
    ...defaultConfig,
    ...config,
    lastfmDefaults: {
      ...defaultConfig.lastfmDefaults,
      ...config.lastfmDefaults,
    },
    sidebar: { ...defaultConfig.sidebar, ...config.sidebar },
    features: { ...defaultConfig.features, ...config.features },
    infinityMix: { ...defaultConfig.infinityMix, ...config.infinityMix },
    scrobbleCount: config.scrobbleCount ?? defaultConfig.scrobbleCount,
  }
}

export const appConfig = loadAppConfig()
