import { httpClient } from '@/api/httpClient'
import { SubsonicResponse } from '@/types/responses/subsonicResponse'
import { appConfig } from '@/utils/appConfig'

interface ShareResponse
  extends SubsonicResponse<{ shares?: { share?: { url: string }[] } }> {}

// Navidrome builds the link from the address it was reached on, which is the
// internal one of the Docker network. SHARE_BASE_URL replaces it with the
// address the link can be opened on.
function withShareBaseUrl(link: string) {
  const base = appConfig.shareBaseUrl
  if (!base) return link

  try {
    const original = new URL(link)
    const target = new URL(base)
    const prefix = target.pathname.replace(/\/+$/, '')

    return `${target.origin}${prefix}${original.pathname}${original.search}${original.hash}`
  } catch {
    return link
  }
}

// Asks the server for a public link to a song or an album
async function createShare(id: string) {
  const response = await httpClient<ShareResponse>('/createShare', {
    method: 'GET',
    query: { id },
  })

  const link = response?.data.shares?.share?.[0]?.url

  return link ? withShareBaseUrl(link) : link
}

export const share = {
  createShare,
}
