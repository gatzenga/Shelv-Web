// Radio stations, artwork and playlist segments come from servers somebody
// else runs. The backend may not be turned into a way to reach what only it can
// reach: Navidrome and the other containers, the host, or the metadata service
// of a cloud. A station in the home network stays possible, because the first
// address decides what is allowed: a public one may never lead to a private one.
import { lookup as dnsLookup } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isIPv4, isIPv6 } from 'node:net'

export type AddressKind = 'blocked' | 'private' | 'public'

function classifyIPv4(address: string): AddressKind {
  const [a, b] = address.split('.').map(Number)

  // 0.0.0.0/8, link local (cloud metadata), multicast and reserved
  if (a === 0 || a >= 224 || (a === 169 && b === 254)) return 'blocked'

  if (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  ) {
    return 'private'
  }

  return 'public'
}

export function classifyAddress(address: string): AddressKind {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '')

  if (isIPv4(value)) return classifyIPv4(value)
  if (!isIPv6(value)) return 'blocked'

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value)
  if (mapped) return classifyIPv4(mapped[1])

  if (value === '::') return 'blocked'
  if (value === '::1') return 'private'
  // fe80::/10 link local, ff00::/8 multicast
  if (/^fe[89ab]/.test(value) || value.startsWith('ff')) return 'blocked'
  // fc00::/7 unique local
  if (/^f[cd]/.test(value)) return 'private'

  return 'public'
}

// What a request may reach. allowPrivate stays unknown until the first address
// of the request is seen, then it is the kind of that address.
export interface Reach {
  allowPrivate: boolean | null
}

export function isAllowed(reach: Reach, address: string) {
  const kind = classifyAddress(address)
  if (kind === 'blocked') return false

  if (reach.allowPrivate === null) reach.allowPrivate = kind === 'private'

  return kind === 'public' || reach.allowPrivate
}

// Checks the address that is really connected to, so a name that answers with
// another address the second time does not get around it
export function guardedLookup(reach: Reach): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, options, (error, address, family) => {
      if (error) {
        callback(error, address as never, family as never)
        return
      }

      // the connection asks for all addresses of a name at once, or for one
      const found = Array.isArray(address)
        ? address
        : [{ address, family: family ?? 4 }]
      const allowed = found.filter((item) => isAllowed(reach, item.address))

      if (allowed.length === 0) {
        callback(
          Object.assign(new Error(`${hostname} is not allowed`), {
            code: 'EBLOCKED',
          }),
          '' as never,
          4,
        )
        return
      }

      if (Array.isArray(address)) {
        callback(null, allowed as never, undefined as never)
      } else {
        callback(null, allowed[0].address, allowed[0].family)
      }
    })
  }
}
