// Instant mix for a song, an album or an artist, built by the backend.
// Follows the Shelv player (InstantMixService.swift and
// InstantMixQueueBuilder.swift): up to 50 songs, the seed song first,
// played in this order.
import type { ServerResponse } from 'node:http'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'
import {
  createClient,
  SubsonicError,
  type SubsonicRequest,
} from './subsonic-client.ts'

const targetCount = 50

type MixKind = 'song' | 'album' | 'artist'

const mixKinds: MixKind[] = ['song', 'album', 'artist']

export interface Song {
  id: string
  artist?: string
  artistId?: string
  genre?: string
  [key: string]: unknown
}

interface AlbumDetail {
  artist?: string
  artistId?: string
  genre?: string
  song?: Song[]
}

// Shelv remembers the last seed per artist, so two artist mixes in a row
// do not start with the same song
const lastArtistSeeds = new Map<string, string>()

class MixQueue {
  readonly songs: Song[] = []
  private readonly seen = new Set<string>()

  get isFull() {
    return this.songs.length >= targetCount
  }

  append(incoming: Song[] | null | undefined) {
    for (const song of incoming ?? []) {
      if (this.isFull) return
      if (this.seen.has(song.id)) continue
      this.seen.add(song.id)
      this.songs.push(song)
    }
  }
}

// A failed endpoint only means fewer songs, like in Shelv
export async function attempt<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch {
    return null
  }
}

export function similarSongs(request: SubsonicRequest, id: string) {
  return attempt(async () => {
    const body = await request<{ similarSongs?: { song?: Song[] } }>(
      'getSimilarSongs',
      { id, count: String(targetCount) },
    )
    return body.similarSongs?.song ?? []
  })
}

export function similarSongs2(request: SubsonicRequest, artistId: string) {
  return attempt(async () => {
    const body = await request<{ similarSongs2?: { song?: Song[] } }>(
      'getSimilarSongs2',
      { id: artistId, count: String(targetCount) },
    )
    return body.similarSongs2?.song ?? []
  })
}

export function randomSongsOfGenre(request: SubsonicRequest, genre: string) {
  return attempt(async () => {
    const body = await request<{ randomSongs?: { song?: Song[] } }>(
      'getRandomSongs',
      { size: String(targetCount * 2), genre },
    )
    return body.randomSongs?.song ?? []
  })
}

export function topSongs(request: SubsonicRequest, artist: string) {
  return attempt(async () => {
    const body = await request<{ topSongs?: { song?: Song[] } }>(
      'getTopSongs',
      { artist, count: String(targetCount) },
    )
    return body.topSongs?.song ?? []
  })
}

function albumDetail(request: SubsonicRequest, id: string) {
  return attempt(async () => {
    const body = await request<{ album?: AlbumDetail }>('getAlbum', { id })
    return body.album ?? null
  })
}

function randomElement<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function shuffled<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item)
}

// Shelv: moreLikeThisQueue
async function moreLikeThis(request: SubsonicRequest, seed: Song) {
  const queue = new MixQueue()
  queue.append([seed])

  queue.append(await similarSongs(request, seed.id))
  if (queue.isFull) return queue.songs

  if (seed.artistId) {
    queue.append(await similarSongs2(request, seed.artistId))
    if (queue.isFull) return queue.songs
  }

  if (seed.genre) {
    queue.append(await randomSongsOfGenre(request, seed.genre))
    if (queue.isFull) return queue.songs
  }

  if (seed.artist) {
    queue.append(await topSongs(request, seed.artist))
  }

  return queue.songs
}

async function songMix(request: SubsonicRequest, id: string) {
  const body = await request<{ song?: Song }>('getSong', { id })
  if (!body.song) return []

  return moreLikeThis(request, body.song)
}

// Shelv: albumMix, a random song of the album is the seed
async function albumMix(request: SubsonicRequest, id: string) {
  const album = await albumDetail(request, id)
  const albumSongs = album?.song ?? []

  if (albumSongs.length > 0) {
    return moreLikeThis(request, randomElement(albumSongs))
  }

  const queue = new MixQueue()

  if (album?.artistId) {
    queue.append(await similarSongs2(request, album.artistId))
    if (queue.isFull) return queue.songs
  }
  if (album?.genre) {
    queue.append(await randomSongsOfGenre(request, album.genre))
    if (queue.isFull) return queue.songs
  }
  if (album?.artist) {
    queue.append(await topSongs(request, album.artist))
  }

  return queue.songs
}

function normalizedName(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// Shelv: InstantMixQueueBuilder.artistSeedCandidates
function seedCandidates(songs: Song[], artistId: string, artistName: string) {
  return songs.filter((song) =>
    song.artistId
      ? song.artistId === artistId
      : song.artist !== undefined &&
        normalizedName(song.artist) === normalizedName(artistName),
  )
}

// Shelv: InstantMixQueueBuilder.randomSeed
function randomSeed(candidates: Song[], avoidingId: string | undefined) {
  if (candidates.length === 0) return null

  const pool =
    candidates.length > 1 && avoidingId
      ? candidates.filter((song) => song.id !== avoidingId)
      : candidates

  return randomElement(pool.length > 0 ? pool : candidates)
}

// Shelv: randomSeedSong
async function artistSeed(
  request: SubsonicRequest,
  artistId: string,
  artistName: string,
) {
  const previousId = lastArtistSeeds.get(artistId)
  let repeatedFallback: Song | null = null

  const artist = await attempt(async () => {
    const body = await request<{ artist?: { album?: { id: string }[] } }>(
      'getArtist',
      { id: artistId },
    )
    return body.artist ?? null
  })

  for (const album of shuffled(artist?.album ?? [])) {
    const detail = await albumDetail(request, album.id)
    if (!detail) continue

    const seed = randomSeed(
      seedCandidates(detail.song ?? [], artistId, artistName),
      previousId,
    )
    if (!seed) continue
    if (seed.id !== previousId) return seed

    repeatedFallback ??= seed
  }

  if (repeatedFallback) return repeatedFallback

  const top = (await topSongs(request, artistName)) ?? []

  return randomSeed(seedCandidates(top, artistId, artistName), previousId)
}

async function artistMix(request: SubsonicRequest, id: string) {
  const body = await request<{ artist?: { name?: string } }>('getArtist', {
    id,
  })
  const name = body.artist?.name ?? ''
  const queue = new MixQueue()

  const seed = await artistSeed(request, id, name)
  if (seed) {
    lastArtistSeeds.set(id, seed.id)
    queue.append([seed])
  }

  queue.append(await similarSongs2(request, id))

  return queue.songs
}

export async function sendInstantMix(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
) {
  const kind = url.searchParams.get('kind') as MixKind | null
  const id = url.searchParams.get('id')

  if (!kind || !mixKinds.includes(kind) || !id) {
    sendJson(res, 400, {
      error: `kind (${mixKinds.join(', ')}) and id are required`,
    })
    return
  }

  const request = createClient(config, url.searchParams)
  const build = { song: songMix, album: albumMix, artist: artistMix }[kind]

  try {
    const songs = await build(request, id)

    res.setHeader('cache-control', 'no-store')
    // Shelv: a mix with only the seed song is not a mix
    sendJson(res, 200, { songs: songs.length > 1 ? songs : [] })
  } catch (error) {
    if (!(error instanceof SubsonicError)) throw error
    sendJson(res, 502, { error: 'instant mix could not be created' })
  }
}
