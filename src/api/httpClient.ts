import omit from 'lodash/omit'
import { useAppStore } from '@/store/app.store'
import { CoverArt } from '@/types/coverArtType'
import { AuthType } from '@/types/serverConfig'
import { appName } from '@/utils/appName'
import { saltWord } from '@/utils/salt'

export type QueryType = Record<string, string | number | undefined>

export interface FetchOptions extends RequestInit {
  query?: QueryType
}

type AuthParams = { u: string; t: string; s: string } | { u: string; p: string }

export function authQueryParams(
  username: string,
  password: string,
  authType: AuthType | null,
): AuthParams {
  if (authType === AuthType.TOKEN) {
    return {
      u: username ?? '',
      t: password ?? '',
      s: saltWord,
    }
  } else if (authType === AuthType.PASSWORD) {
    return {
      u: username ?? '',
      p: password ?? '',
    }
  }
  throw new Error('Invalid/unspecified auth type')
}

function queryParams() {
  const { username, password, authType, protocolVersion } =
    useAppStore.getState().data

  return {
    ...authQueryParams(username, password, authType),
    v: protocolVersion || '1.16.0',
    c: appName,
    f: 'json',
  }
}

function buildQuery(options?: QueryType) {
  const params = new URLSearchParams(queryParams())

  if (options) {
    Object.keys(options).forEach((key) => {
      const query = options[key]

      if (query !== undefined) {
        params.append(key, query.toString())
      }
    })
  }

  return params.toString()
}

function getUrl(path: string, options?: QueryType) {
  const serverUrl = useAppStore.getState().data.url
  const pathWithoutSlash = path.startsWith('/') ? path.substring(1) : path
  let url = `${serverUrl}/rest/${pathWithoutSlash}`
  url += path.includes('?') ? '&' : '?'
  url += buildQuery(options)

  return url
}

// Routes of the backend in this container (/api/*), authenticated with the
// same Subsonic credentials as /rest/*
export function getBackendUrl(path: string, options?: QueryType) {
  const serverUrl = useAppStore.getState().data.url

  return `${serverUrl}${path}?${buildQuery(options)}`
}

async function browserFetch<T>(
  url: string,
  options: RequestInit,
): Promise<{ count: number; data: T } | undefined> {
  try {
    const response = await fetch(url, options)

    if (response.ok) {
      const data = await response.json()
      return {
        count: parseInt(response.headers.get('x-total-count') || '0', 10),
        data: data['subsonic-response'] as T,
      }
    }

    return undefined
  } catch (error) {
    console.error('Error on browserFetch request', error)
    return undefined
  }
}

export async function httpClient<T>(
  path: string,
  options: FetchOptions,
): Promise<{ count: number; data: T } | undefined> {
  try {
    const url = getUrl(path, options.query)
    const init = omit(options, 'query')

    return await browserFetch<T>(url, init)
  } catch (error) {
    console.error('Error on httpClient request', error)
    return undefined
  }
}

export function getSimpleCoverArtUrl(
  id?: string,
  type: CoverArt = 'album',
  size = '300',
): string {
  if (!id) {
    // everything except artists uses the same default cover art
    const resolvedType = type === 'artist' ? 'artist' : 'album'
    return `/default_${resolvedType}_art.png`
  }

  return getUrl('getCoverArt', { id, size })
}

export async function getCoverArtUrl(
  id?: string,
  type: CoverArt = 'album',
  size = '300',
): Promise<string> {
  return getSimpleCoverArtUrl(id, type, size)
}

export function getSongStreamUrl(
  id: string,
  maxBitRate?: string,
  format?: string,
) {
  return getUrl('stream', {
    id,
    maxBitRate,
    format,
    estimateContentLength: 'true',
  })
}
