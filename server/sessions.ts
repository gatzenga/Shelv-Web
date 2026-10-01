// Sessions: after the login the browser only holds a random id in a cookie.
// The Navidrome credentials stay here and are put on every request, so they
// are not sent over the network again and do not end up in addresses or logs.
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { logger } from './logger.ts'

export const sessionLifetime = 30 * 24 * 60 * 60 * 1000
const maxSessionsPerUser = 10

// Over https the cookie gets the prefix __Host-: the browser then only takes it
// from this very host, and no other site or subdomain can set it
export function sessionCookieName(https: boolean) {
  return https ? '__Host-shelv_session' : 'shelv_session'
}

export interface SessionCredentials {
  u: string
  t: string
  s: string
}

interface StoredSession extends SessionCredentials {
  expiresAt: number
}

export function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>()

  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue

    cookies.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }

  return cookies
}

export class SessionStore {
  private sessions = new Map<string, StoredSession>()
  private readonly file: string | null
  private writing: Promise<void> = Promise.resolve()

  // without a file the sessions only live until the next start
  constructor(file: string | null = null) {
    this.file = file
  }

  async load() {
    if (!this.file) return

    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf-8')) as Record<
        string,
        StoredSession
      >

      for (const [id, session] of Object.entries(parsed)) {
        if (this.isValid(session)) this.sessions.set(id, session)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn(`could not read ${this.file}`, error)
      }
    }
  }

  private isValid(
    session: StoredSession | undefined,
  ): session is StoredSession {
    return (
      session !== undefined &&
      typeof session.u === 'string' &&
      typeof session.t === 'string' &&
      typeof session.s === 'string' &&
      session.expiresAt > Date.now()
    )
  }

  // undefined when the id is unknown or has expired
  get(id: string | undefined): SessionCredentials | undefined {
    if (!id) return undefined

    const session = this.sessions.get(id)
    if (!this.isValid(session)) {
      if (session) this.sessions.delete(id)
      return undefined
    }

    return { u: session.u, t: session.t, s: session.s }
  }

  async create(credentials: SessionCredentials) {
    const id = randomBytes(32).toString('base64url')

    this.sessions.set(id, {
      ...credentials,
      expiresAt: Date.now() + sessionLifetime,
    })
    this.limitPerUser(credentials.u)
    await this.save()

    return id
  }

  // Every login makes a session, so the oldest ones of a user make room
  private limitPerUser(user: string) {
    const name = user.toLowerCase()
    const ids = [...this.sessions]
      .filter(([, session]) => session.u.toLowerCase() === name)
      .map(([id]) => id)

    for (const id of ids.slice(
      0,
      Math.max(ids.length - maxSessionsPerUser, 0),
    )) {
      this.sessions.delete(id)
    }
  }

  async delete(id: string | undefined) {
    if (!id || !this.sessions.delete(id)) return

    await this.save()
  }

  private save() {
    const file = this.file
    if (!file) return Promise.resolve()

    const run = async () => {
      for (const [id, session] of this.sessions) {
        if (!this.isValid(session)) this.sessions.delete(id)
      }

      // the sessions are as good as the passwords, so only this user may read them
      await mkdir(dirname(file), { recursive: true })
      const temporary = `${file}.tmp`
      await writeFile(
        temporary,
        JSON.stringify(Object.fromEntries(this.sessions)),
        { encoding: 'utf-8', mode: 0o600 },
      )
      await rename(temporary, file)
    }

    const result = this.writing.then(run, run)
    this.writing = result.catch(() => {})

    return result.catch((error) => {
      logger.warn(`could not write ${file}`, error)
    })
  }
}

// Logins that did not work, so a password cannot be tried again and again.
// Counted per address and per user: the address alone is no protection when
// somebody has many of them. An attempt counts from the moment it starts,
// so a burst of requests at once is stopped as well.
const window = 10 * 60 * 1000
const maxPerAddress = 10
const maxPerUser = 50
const maxKeys = 10_000

export class LoginLimiter {
  private byAddress = new Map<string, number[]>()
  private byUser = new Map<string, number[]>()

  // false when there were too many attempts
  start(address: string, user: string) {
    const addressKey = address.slice(0, 64)
    const userKey = user.toLowerCase().slice(0, 64)
    const fromAddress = this.recent(this.byAddress, addressKey)
    const fromUser = this.recent(this.byUser, userKey)

    if (fromAddress.length >= maxPerAddress || fromUser.length >= maxPerUser) {
      return false
    }

    const now = Date.now()
    this.keep(this.byAddress, addressKey, [...fromAddress, now])
    this.keep(this.byUser, userKey, [...fromUser, now])
    return true
  }

  // a login that worked does not count
  succeed(address: string, user: string) {
    this.forgive(this.byAddress, address.slice(0, 64))
    this.forgive(this.byUser, user.toLowerCase().slice(0, 64))
  }

  private recent(map: Map<string, number[]>, key: string) {
    const now = Date.now()
    const recent = (map.get(key) ?? []).filter((time) => now - time < window)

    if (recent.length === 0) map.delete(key)
    return recent
  }

  private keep(map: Map<string, number[]>, key: string, times: number[]) {
    // the keys stay in the order of their last use, the oldest one goes first
    map.delete(key)
    map.set(key, times)

    // Somebody who makes up addresses must not fill the memory
    if (map.size > maxKeys) {
      const oldest = map.keys().next().value
      if (oldest !== undefined) map.delete(oldest)
    }
  }

  private forgive(map: Map<string, number[]>, key: string) {
    const times = map.get(key)
    if (!times) return

    times.pop()
    if (times.length === 0) map.delete(key)
  }
}
