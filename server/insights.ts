// Insights: the most played artists, albums and songs, built from the play
// counts of the server like in the Shelv app (InsightsView.swift).
import type { ServerResponse } from 'node:http'
import type { ServerConfig } from './config.ts'
import { mostPlayedSongs } from './frequent-songs.ts'
import { sendJson } from './http.ts'
import { type Album, albumList } from './smart-mix.ts'
import { createClient, SubsonicError } from './subsonic-client.ts'

const listSize = 20

interface InsightAlbum extends Album {
  artist?: string
  artistId?: string
  [key: string]: unknown
}

// Compilations and unknown artists are not an artist to rank
const excludedArtists = new Set([
  'various artists',
  'various artist',
  'various',
  'va',
  'v.a.',
  'v/a',
  'diverse',
  'divers',
  'sampler',
  'compilation',
  'compilations',
  'verschiedene künstler',
  'verschiedene',
  'mehrere interpreten',
  'artistas varios',
  'varios artistas',
  'artistes variés',
  'unknown artist',
  'unbekannter künstler',
  'unknown',
  'unbekannt',
])

function byPlayCount(a: { id: string; playCount?: number }, b: typeof a) {
  const difference = (b.playCount ?? 0) - (a.playCount ?? 0)

  return difference !== 0 ? difference : a.id.localeCompare(b.id)
}

function topArtists(albums: InsightAlbum[]) {
  const artists = new Map<
    string,
    { id: string; name: string; playCount: number; hasImage: boolean }
  >()

  for (const album of albums) {
    const name = album.artist ?? 'Unknown'
    if (excludedArtists.has(name.toLowerCase())) continue

    const id = album.artistId ?? `_${name}`
    const playCount = album.playCount ?? 0
    const entry = artists.get(id)

    if (entry) {
      entry.playCount += playCount
    } else {
      artists.set(id, {
        id,
        name,
        playCount,
        hasImage: Boolean(album.artistId),
      })
    }
  }

  return [...artists.values()].sort(byPlayCount).slice(0, listSize)
}

export async function sendInsights(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
) {
  const request = createClient(config, url.searchParams)

  try {
    const albums = (await albumList(request, 'frequent', 500)) as InsightAlbum[]

    sendJson(res, 200, {
      artists: topArtists(albums),
      albums: [...albums].sort(byPlayCount).slice(0, listSize),
      songs: await mostPlayedSongs(request, albums, listSize),
    })
  } catch (error) {
    if (!(error instanceof SubsonicError)) throw error
    sendJson(res, 502, { error: 'insights could not be loaded' })
  }
}
