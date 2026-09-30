import { getBackendUrl } from '@/api/httpClient'

export interface LyricsStats {
  count: number
  sizeBytes: number
  isDownloading: boolean
  downloadFetched: number
  downloadTotal: number
}

export interface LyricsSearchResult {
  id: string
  songId: string
  songTitle: string | null
  artistName: string | null
  albumId: string | null
  coverArt: string | null
  snippet: string
  duration: number | null
}

export async function getLyricsStats(): Promise<LyricsStats | null> {
  try {
    const res = await fetch(getBackendUrl('/api/lyrics/stats'))
    if (!res.ok) return null
    return (await res.json()) as LyricsStats
  } catch {
    return null
  }
}

export async function startLyricsDownload(): Promise<{
  started: boolean
  message?: string
}> {
  try {
    const res = await fetch(getBackendUrl('/api/lyrics/download-all'), {
      method: 'POST',
    })
    if (!res.ok) return { started: false }
    return (await res.json()) as { started: boolean; message?: string }
  } catch {
    return { started: false }
  }
}

export async function cancelLyricsDownload(): Promise<boolean> {
  try {
    const res = await fetch(getBackendUrl('/api/lyrics/cancel-download'), {
      method: 'POST',
    })
    return res.ok
  } catch {
    return false
  }
}

export async function resetLyricsDb(): Promise<boolean> {
  try {
    const res = await fetch(getBackendUrl('/api/lyrics/reset'), {
      method: 'POST',
    })
    return res.ok
  } catch {
    return false
  }
}

export async function searchLyrics(
  query: string,
  limit = 40,
): Promise<LyricsSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    const res = await fetch(
      getBackendUrl('/api/lyrics/search', { q: trimmed, limit: String(limit) }),
    )
    if (!res.ok) return []
    const data = (await res.json()) as { results: LyricsSearchResult[] }
    return data.results ?? []
  } catch {
    return []
  }
}
