// Infinity mix replenishment following the Shelv player
// (InfinityMixPoolBuilder.swift and AudioPlayerService.swift nextInfinitySong / seededInfinityPool).
import type { ServerResponse } from 'node:http'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'
import {
  attempt,
  randomSongsOfGenre,
  type Song,
  similarSongs,
  similarSongs2,
  topSongs,
} from './instant-mix.ts'
import {
  createClient,
  SubsonicError,
  type SubsonicRequest,
} from './subsonic-client.ts'

export const poolSize = 25
export const discoveryStride = 4

export class InfinityMixPoolBuilder {
  static pool(
    similar: Song[],
    discovery: Song[],
    excluded: Set<string> = new Set(),
    limit: number = poolSize,
  ): Song[] {
    if (limit <= 0) return []
    const seen = new Set<string>(excluded)
    const similarQueue = [...similar]
    const discoveryQueue = [...discovery]
    const result: Song[] = []

    function take(queue: Song[]): Song | null {
      while (queue.length > 0) {
        const song = queue.shift()!
        if (seen.has(song.id)) continue
        seen.add(song.id)
        return song
      }
      return null
    }

    while (result.length < limit) {
      const position = result.length + 1
      const wantsDiscovery =
        discoveryStride > 0 && position % discoveryStride === 0
      const picked = wantsDiscovery
        ? (take(discoveryQueue) ?? take(similarQueue))
        : (take(similarQueue) ?? take(discoveryQueue))
      if (!picked) break
      result.push(picked)
    }

    return result
  }
}

function randomSongs(request: SubsonicRequest, size: number) {
  return attempt(async () => {
    const body = await request<{ randomSongs?: { song?: Song[] } }>(
      'getRandomSongs',
      { size: String(size) },
    )
    return body.randomSongs?.song ?? []
  })
}

function songDetail(request: SubsonicRequest, id: string) {
  return attempt(async () => {
    const body = await request<{ song?: Song }>('getSong', { id })
    return body.song ?? null
  })
}

export async function sendInfinityMix(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
) {
  const seedId = url.searchParams.get('seedId')
  const excludeParam = url.searchParams.get('exclude') ?? ''
  const excluded = new Set(excludeParam.split(',').filter(Boolean))
  const matchParam = url.searchParams.get('match')
  const shouldMatch =
    matchParam !== null
      ? matchParam === 'true'
      : config.client.infinityMix.matchCurrentSong

  const countParam = Number.parseInt(url.searchParams.get('count') ?? '25', 10)
  const count = Math.min(
    Math.max(Number.isNaN(countParam) ? 25 : countParam, 1),
    50,
  )

  const request = createClient(config, url.searchParams)

  try {
    let result: Song[] = []

    if (shouldMatch && seedId) {
      const seed = await songDetail(request, seedId)
      if (seed) {
        excluded.add(seed.id)
        const similar: Song[] = []
        const seen = new Set<string>([seed.id])

        function collect(songs: Song[] | null | undefined) {
          for (const s of songs ?? []) {
            if (!seen.has(s.id)) {
              seen.add(s.id)
              similar.push(s)
            }
          }
        }

        collect(await similarSongs(request, seed.id))
        if (similar.length < poolSize && seed.artistId) {
          collect(await similarSongs2(request, seed.artistId))
        }
        if (similar.length < poolSize && seed.genre) {
          collect(await randomSongsOfGenre(request, seed.genre))
        }
        if (similar.length < poolSize && seed.artist) {
          collect(await topSongs(request, seed.artist))
        }

        const discovery = (await randomSongs(request, poolSize)) ?? []
        result = InfinityMixPoolBuilder.pool(
          similar,
          discovery,
          excluded,
          count,
        )

        // Fallback: if excluded filtered everything out, allow repeats rather than failing
        if (result.length === 0 && similar.length > 0) {
          result = InfinityMixPoolBuilder.pool(
            similar,
            discovery,
            new Set([seed.id]),
            count,
          )
        }
      }
    }

    if (result.length === 0) {
      const random = (await randomSongs(request, poolSize)) ?? []
      const filtered = random.filter((s) => !excluded.has(s.id))
      result = (filtered.length > 0 ? filtered : random).slice(0, count)
    }

    res.setHeader('cache-control', 'no-store')
    sendJson(res, 200, { songs: result })
  } catch (error) {
    if (!(error instanceof SubsonicError)) throw error
    sendJson(res, 502, { error: 'infinity mix could not be created' })
  }
}
