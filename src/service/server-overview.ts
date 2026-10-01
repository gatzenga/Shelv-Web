import { getBackendUrl } from '@/api/httpClient'
import { subsonic } from '@/service/subsonic'

const pageSize = 500

async function countAlbums() {
  let total = 0

  for (let offset = 0; ; offset += pageSize) {
    const page = await subsonic.albums.getAlbumList({
      type: 'alphabeticalByName',
      size: pageSize,
      offset,
    })
    const count = page.list?.length ?? 0

    total += count
    if (count < pageSize) return total
  }
}

async function getNavidromeUrl() {
  const response = await fetch(getBackendUrl('/api/server-info'), {
    cache: 'no-store',
  })
  if (!response.ok) return null

  // only an administrator gets the address
  const { navidromeUrl } = (await response.json()) as {
    navidromeUrl: string | null
  }

  return navidromeUrl
}

// The data of the Manage Servers sheet, like the server screen of the Shelv app
export async function getServerOverview() {
  const [info, scan, artists, albums, navidromeUrl] = await Promise.all([
    subsonic.ping.pingInfo(),
    subsonic.library.getScanStatus(),
    subsonic.artists.getAll(),
    countAlbums(),
    getNavidromeUrl().catch(() => null),
  ])

  return {
    navidromeUrl,
    serverVersion: info?.serverVersion,
    serverType: info?.type,
    apiVersion: info?.version,
    tracks: Number(scan?.count ?? 0),
    artists: artists.length,
    albums,
  }
}

export type ServerOverview = Awaited<ReturnType<typeof getServerOverview>>
