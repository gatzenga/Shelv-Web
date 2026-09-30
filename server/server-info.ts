import type { ServerResponse } from 'node:http'
import { verifyCredentials } from './auth.ts'
import type { ServerConfig } from './config.ts'
import { sendJson } from './http.ts'

// The address of Navidrome as the backend reaches it. It is an internal
// address, so only a signed in user gets it.
export async function sendServerInfo(
  config: ServerConfig,
  res: ServerResponse,
  url: URL,
) {
  if (!(await verifyCredentials(config.navidromeUrl, url.searchParams))) {
    sendJson(res, 401, { error: 'unauthorized' })
    return
  }

  res.setHeader('cache-control', 'no-store')
  sendJson(res, 200, { navidromeUrl: config.navidromeUrl })
}
