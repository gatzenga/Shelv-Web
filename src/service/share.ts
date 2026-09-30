import { httpClient } from '@/api/httpClient'
import { SubsonicResponse } from '@/types/responses/subsonicResponse'

interface ShareResponse
  extends SubsonicResponse<{ shares?: { share?: { url: string }[] } }> {}

// Asks the server for a public link to a song or an album
async function createShare(id: string) {
  const response = await httpClient<ShareResponse>('/createShare', {
    method: 'GET',
    query: { id },
  })

  return response?.data.shares?.share?.[0]?.url
}

export const share = {
  createShare,
}
