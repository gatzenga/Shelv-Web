import { join } from 'node:path'

// Reads the container environment once at startup.
// Everything under `client` is public and delivered to the browser,
// everything else stays inside the backend.

type Language = 'de' | 'en'

const discoverSectionNames = [
  'smart-mixes',
  'recently-added',
  'recently-played',
  'frequently-played',
  'random-albums',
] as const

export type DiscoverSection = (typeof discoverSectionNames)[number]

export interface ClientConfig {
  language: Language
  lyrics: boolean
  lastfm: boolean
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
}

export interface ServerConfig {
  port: number
  distDir: string
  configDir: string
  logsDir: string
  navidromeUrl: string
  lyricsServer: string | null
  lyrics: {
    enabled: boolean
    customServer: string | null
    fallback: boolean
    includeNavidrome: boolean
    defaultServer: string
  }
  cache: {
    dir: string
    images: boolean
    lyrics: boolean
  }
  lastfm: {
    apiKey: string
    sharedSecret: string
    sessionFile: string
    // the time span of the Frequently Played mix
    period: LastFMPeriod
  }
  client: ClientConfig
}

function readString(name: string, fallback: string): string {
  const value = process.env[name]?.trim()

  return value ? value : fallback
}

function readUrl(name: string, fallback: string | null): string | null {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  try {
    const url = new URL(value)
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new Error(`${name} is not a valid URL: "${value}"`)
  }
}

function readRequiredUrl(name: string): string {
  const url = readUrl(name, null)
  if (!url) throw new Error(`${name} is required`)

  return url
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback

  if (value === 'true') return true
  if (value === 'false') return false

  throw new Error(`${name} must be "true" or "false", got "${value}"`)
}

const lastfmPeriods = [
  '7day',
  '1month',
  '3month',
  '6month',
  '12month',
  'overall',
] as const

export type LastFMPeriod = (typeof lastfmPeriods)[number]

function readLastFMPeriod(name: string, fallback: LastFMPeriod): LastFMPeriod {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback

  const period = lastfmPeriods.find((item) => item === value)
  if (period) return period

  throw new Error(
    `${name} must be one of ${lastfmPeriods.join(', ')}, got "${value}"`,
  )
}

function readLanguage(name: string, fallback: Language): Language {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback

  if (value === 'de' || value === 'en') return value

  throw new Error(`${name} must be "de" or "en", got "${value}"`)
}

// The order of the sections on the Discover page, first to last. A section
// that is not listed is not shown.
function readDiscoverSections(
  name: string,
  fallback: DiscoverSection[],
): DiscoverSection[] {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  const sections: DiscoverSection[] = []

  for (const entry of value.split(',')) {
    const section = entry.trim().toLowerCase()
    if (!section) continue

    if (!(discoverSectionNames as readonly string[]).includes(section)) {
      throw new Error(
        `${name} contains "${section}", allowed are ${discoverSectionNames.join(', ')}`,
      )
    }
    if (!sections.includes(section as DiscoverSection)) {
      sections.push(section as DiscoverSection)
    }
  }

  return sections
}

function readInt(name: string, fallback: number, min = 1, max = 10): number {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  const num = Number(value)
  if (!Number.isInteger(num)) return fallback

  return Math.min(Math.max(num, min), max)
}

function readPort(name: string, fallback: number): number {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid port, got "${value}"`)
  }

  return port
}

function readScrobbleCount(fallback = 30): number {
  const raw =
    process.env.SCROBBLE_COUNT?.trim() ||
    process.env.COUNT_FROM?.trim() ||
    process.env.SCROBBLE_PERCENT?.trim()
  if (!raw) return fallback

  const num = Number(raw)
  if (!Number.isFinite(num)) return fallback

  const allowed = [10, 20, 30, 40, 50]
  if (allowed.includes(num)) return num

  if (Number.isInteger(num) && num >= 5 && num <= 95) return num

  return fallback
}

export function loadConfig(): ServerConfig {
  const lyricsCustomServer =
    readUrl('LYRICS_CUSTOM_SERVER', null) ?? readUrl('LYRICS_SERVER', null)
  // Like the lyrics settings of the Shelv app: both are off until switched on
  const includeNavidromeLyrics = readBoolean('LYRICS_NAVIDROME', false)
  // Nothing turned on means the public LRCLIB, it is the default source
  const lrclibFallback =
    readBoolean('LYRICS_LRCLIB', false) ||
    (!includeNavidromeLyrics && lyricsCustomServer === null)
  const lastfmApiKey =
    readString('LASTFM_API', '') || readString('LASTFM_API_KEY', '')
  const lastfmSecret = readString('LASTFM_SECRET', '')
  const isLastfmConfigured = Boolean(lastfmApiKey && lastfmSecret)
  const configDir = readString('CONFIG_DIR', '/config')

  return {
    port: readPort('PORT', 8080),
    distDir: readString(
      'DIST_DIR',
      new URL('../dist', import.meta.url).pathname,
    ),
    configDir,
    logsDir: readString('LOGS_DIR', '/logs'),
    navidromeUrl: readRequiredUrl('NAVIDROME_URL'),
    lyricsServer: lyricsCustomServer ?? 'https://lrclib.net',
    lyrics: {
      enabled: true,
      customServer: lyricsCustomServer,
      fallback: lrclibFallback,
      includeNavidrome: includeNavidromeLyrics,
      defaultServer: 'https://lrclib.net',
    },
    cache: {
      dir: readString('CACHE_DIR', '/cache'),
      images: readBoolean('CACHE_IMAGES', false),
      lyrics: readBoolean('CACHE_LYRICS', false),
    },
    lastfm: {
      apiKey: lastfmApiKey,
      sharedSecret: lastfmSecret,
      sessionFile: join(configDir, 'lastfm.json'),
      period: readLastFMPeriod('LASTFM_PERIOD', '3month'),
    },
    client: {
      language: readLanguage('LANGUAGE', 'de'),
      lyrics: true,
      lastfm: isLastfmConfigured,
      discoverSections: readDiscoverSections('DISCOVER_SECTIONS', [
        ...discoverSectionNames,
      ]),
      lastfmDefaults: {
        topSongs: readBoolean('LASTFM_TOP_SONGS', true),
        mixes: readBoolean('LASTFM_MIXES', true),
      },
      sidebar: {
        albums: readBoolean('SIDEBAR_ALBUMS', true),
        artists: readBoolean('SIDEBAR_ARTISTS', true),
        genres: readBoolean('SIDEBAR_GENRES', true),
        radios: readBoolean('SIDEBAR_RADIOS', true),
      },
      features: {
        favorites: readBoolean('FEATURE_FAVORITES', true),
        playlists: readBoolean('FEATURE_PLAYLISTS', true),
      },
      infinityMix: {
        songsToAdd: readInt('SONGS_TO_ADD', 5, 1, 10),
        matchCurrentSong: readBoolean('MATCH_CURRENT_SONG', true),
      },
      scrobbleCount: readScrobbleCount(30),
    },
  }
}
