// getAlbumList2 returns every sort type in one fixed direction (e.g. newest
// first). With reverse=true the backend loads the whole list once, reverses
// it and serves it page by page, so the player can sort both ways.
import type { ServerResponse } from 'node:http'
import { authParams, credentialsKey } from './auth.ts'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'
import { TtlCache } from './ttl-cache.ts'

const pageSize = 500
const maxAlbums = 50000
const listLifetime = 60 * 1000

type SubsonicEnvelope = Record<string, unknown> & {
  status?: string
  albumList2?: { album?: unknown[] }
}

interface FullList {
  envelope: SubsonicEnvelope
  albums: unknown[]
}

const lists = new TtlCache<FullList | null>(10)

export function isReversedAlbumList(endpoint: string, params: URLSearchParams) {
  return endpoint === 'getAlbumList2' && params.get('reverse') === 'true'
}

async function loadFullList(config: ServerConfig, params: URLSearchParams) {
  const albums: unknown[] = []
  let envelope: SubsonicEnvelope | null = null

  for (let offset = 0; offset < maxAlbums; offset += pageSize) {
    const url = new URL(`${config.navidromeUrl}/rest/getAlbumList2`)
    for (const [name, value] of params) url.searchParams.set(name, value)
    url.searchParams.set('size', String(pageSize))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('f', 'json')

    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null

    const body = (await response.json()) as {
      'subsonic-response'?: SubsonicEnvelope
    }
    const page = body['subsonic-response']
    if (page?.status !== 'ok') return null

    envelope ??= page
    const pageAlbums = page.albumList2?.album ?? []
    albums.push(...pageAlbums)

    if (pageAlbums.length < pageSize) break
  }

  return envelope ? { envelope, albums } : null
}

// What makes a list another list. Anything else on the address is dropped, so
// it can not be used to have the whole library loaded again and again.
const listParams = [
  ...authParams,
  'type',
  'genre',
  'fromYear',
  'toYear',
  'musicFolderId',
  'v',
  'c',
]

export async function sendReversedAlbumList(
  config: ServerConfig,
  res: ServerResponse,
  searchParams: URLSearchParams,
) {
  const params = new URLSearchParams()
  for (const name of listParams) {
    const value = searchParams.get(name)
    if (value !== null) params.set(name, value)
  }

  const size = Math.min(
    Math.max(Number(searchParams.get('size')) || 10, 1),
    500,
  )
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

  const listKey = [...params.entries()]
    .filter(([name]) => !authParams.includes(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join('&')

  const list = await lists.getOrLoad(
    `${credentialsKey(params)}|${listKey}`,
    (value) => (value ? listLifetime : 0),
    () => loadFullList(config, params),
  )

  if (!list) {
    sendJson(res, 502, { error: 'album list could not be loaded' })
    return
  }

  const albums = [...list.albums].reverse().slice(offset, offset + size)

  res.setHeader('x-total-count', String(list.albums.length))
  sendJson(res, 200, {
    'subsonic-response': { ...list.envelope, albumList2: { album: albums } },
  })
}
