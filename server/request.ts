import type { IncomingMessage } from 'node:http'

type RequestLike = Pick<IncomingMessage, 'headers' | 'socket'>

function header(req: RequestLike, name: string) {
  const value = req.headers[name]

  return Array.isArray(value) ? value[0] : value
}

// Who is asking. Cloudflare names the visitor in CF-Connecting-IP. Any other
// proxy adds the address it saw to the end of X-Forwarded-For, the first
// entries are whatever the client wrote there, so only the last one counts.
export function clientAddress(req: RequestLike) {
  const address =
    header(req, 'cf-connecting-ip')?.trim() ||
    header(req, 'x-forwarded-for')?.split(',').at(-1)?.trim() ||
    req.socket.remoteAddress ||
    'unknown'

  return address.slice(0, 64)
}

export function isHttps(req: RequestLike) {
  if ('encrypted' in req.socket) return true

  const proto = header(req, 'x-forwarded-proto')?.split(',')[0]?.trim()
  if (proto) return proto === 'https'

  return /"scheme"\s*:\s*"https"/.test(header(req, 'cf-visitor') ?? '')
}

// What a browser fetches with an <img> or <audio> element, and not with
// fetch(): the cover art, the songs and the radio
const mediaPaths =
  /^\/(rest\/(stream|download|getCoverArt|getAvatar)(\.view)?|api\/radio\/stream)$/

// A browser says with Sec-Fetch-* where a request comes from. The session
// only works for requests of the app itself: not from another site, and
// outside of fetch() only for media. So a link or an <img> that somebody
// planted on a page can not trigger anything with the session of the user.
export function mayUseSession(req: RequestLike, pathname: string) {
  const site = header(req, 'sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false

  const destination = header(req, 'sec-fetch-dest')
  if (destination && destination !== 'empty') return mediaPaths.test(pathname)

  return true
}
