import type { ServerResponse } from 'node:http'
import { verifyAdmin } from './auth.ts'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'

// The address without a name and password that may be in it, for the log and
// for the screen
export function withoutLogin(address: string) {
  try {
    const url = new URL(address)
    url.username = ''
    url.password = ''

    return url.toString().replace(/\/$/, '')
  } catch {
    return 'invalid address'
  }
}

// The address of Navidrome as the backend reaches it. It is an internal
// address, so only an administrator gets it.
export async function sendServerInfo(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
) {
  const isAdmin = await verifyAdmin(config.navidromeUrl, url.searchParams)

  res.setHeader('cache-control', 'no-store')
  sendJson(res, 200, {
    navidromeUrl: isAdmin ? withoutLogin(config.navidromeUrl) : null,
  })
}
