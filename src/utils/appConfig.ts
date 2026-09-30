// Configuration of the container, set through the docker environment.
// The backend delivers it with /env-config.js before the app starts
// (see server/config.ts). The defaults apply when there is no backend.

export type AppLanguage = 'de' | 'en'

export interface AppConfig {
  language: AppLanguage
  lyrics: boolean
  lastfmDefaults: {
    topSongs: boolean
    mixes: boolean
  }
  sidebar: {
    albums: boolean
    songs: boolean
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
}

const defaultConfig: AppConfig = {
  language: 'de',
  lyrics: false,
  lastfmDefaults: {
    topSongs: true,
    mixes: true,
  },
  sidebar: {
    albums: true,
    songs: true,
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
  }
}

export const appConfig = loadAppConfig()
