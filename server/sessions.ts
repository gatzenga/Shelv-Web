// Sessions: after the login the browser only holds a random id in a cookie.
// The Navidrome credentials stay here and are put on every request, so they
// are not sent over the network again and do not end up in addresses or logs.
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { logger } from './logger.ts'

export const sessionCookieName = 'shelv_session'
export const sessionLifetime = 30 * 24 * 60 * 60 * 1000

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
    await this.save()

    return id
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

      // plain defaults, no chmod: the file gets the rights of the folder
      await mkdir(dirname(file), { recursive: true })
      const temporary = `${file}.tmp`
      await writeFile(
        temporary,
        JSON.stringify(Object.fromEntries(this.sessions)),
        'utf-8',
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

// Wrong logins per address, so a password cannot be tried again and again
const window = 10 * 60 * 1000
const maxFailures = 10

export class LoginLimiter {
  private failures = new Map<string, number[]>()

  isBlocked(address: string) {
    const recent = this.recent(address)
    return recent.length >= maxFailures
  }

  fail(address: string) {
    const recent = this.recent(address)
    recent.push(Date.now())
    this.failures.set(address, recent)
  }

  reset(address: string) {
    this.failures.delete(address)
  }

  private recent(address: string) {
    const now = Date.now()
    const recent = (this.failures.get(address) ?? []).filter(
      (time) => now - time < window,
    )

    if (recent.length === 0) this.failures.delete(address)
    return recent
  }
}
