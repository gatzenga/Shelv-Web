import { getBackendUrl } from '@/api/httpClient'
import { Albums } from '@/types/responses/album'
import { ISong } from '@/types/responses/song'

export interface InsightArtist {
  id: string
  name: string
  playCount: number
  hasImage: boolean
}

export interface Insights {
  artists: InsightArtist[]
  albums: Albums[]
  songs: ISong[]
}

// Built by the backend from the play counts of the server
export async function getInsights() {
  const response = await fetch(getBackendUrl('/api/insights'), {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`insights failed: ${response.status}`)

  return (await response.json()) as Insights
}
