// Starts the real server against a pretend Navidrome and goes through the
// login, the session cookie and the protection of the routes.
import { strict as assert } from 'node:assert'
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

const seenByNavidrome: string[] = []

function listen(server: Server) {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })
}

describe('server', () => {
  let navidrome: Server
  let shelv: ChildProcess
  let base: string

  before(async () => {
    // user "vasco" with the token "good" is known, "admin" is an administrator
    navidrome = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
      seenByNavidrome.push(`${url.pathname}?${url.searchParams.toString()}`)

      const user = url.searchParams.get('u')
      const isKnown =
        (user === 'vasco' || user === 'admin') &&
        url.searchParams.get('t') === 'good'

      const body: Record<string, unknown> = {
        status: isKnown ? 'ok' : 'failed',
        version: '1.16.1',
      }
      if (url.pathname.endsWith('getUser')) {
        body.user = { username: user, adminRole: user === 'admin' }
      }

      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ 'subsonic-response': body }))
    })
    const navidromePort = await listen(navidrome)

    // a free port for the server under test
    const probe = createServer()
    const port = await listen(probe)
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const folder = await mkdtemp(join(tmpdir(), 'shelv-server-'))
    shelv = spawn('node', ['server/index.ts'], {
      env: {
        ...process.env,
        NAVIDROME_URL: `http://127.0.0.1:${navidromePort}`,
        PORT: String(port),
        CONFIG_DIR: join(folder, 'config'),
        LOGS_DIR: join(folder, 'logs'),
        CACHE_DIR: join(folder, 'cache'),
      },
      stdio: 'ignore',
    })

    base = `http://127.0.0.1:${port}`
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`${base}/api/health`)
        if (response.ok) return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('the server did not start')
  })

  after(async () => {
    shelv.kill()
    await new Promise<void>((resolve) => navidrome.close(() => resolve()))
  })

  async function login(user: string, token: string, address = '10.0.0.1') {
    return fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': address },
      body: JSON.stringify({ u: user, t: token, s: 'salt' }),
    })
  }

  function cookieOf(response: Response) {
    return response.headers.get('set-cookie')?.split(';')[0] ?? ''
  }

  test('the app and the health check are open', async () => {
    assert.equal((await fetch(`${base}/api/health`)).status, 200)
    assert.equal((await fetch(`${base}/api/config`)).status, 200)
  })

  test('the routes need a login', async () => {
    for (const path of [
      '/api/lyrics/stats',
      '/api/lastfm/status',
      '/api/insights',
      '/api/mix',
      '/api/server-info',
    ]) {
      assert.equal((await fetch(`${base}${path}`)).status, 401, path)
    }
  })

  test('a wrong login is refused and sets no cookie', async () => {
    const response = await login('vasco', 'wrong', '10.0.0.2')

    assert.equal(response.status, 401)
    assert.equal(response.headers.get('set-cookie'), null)
  })

  test('a right login sets a cookie that is safe', async () => {
    const response = await login('vasco', 'good')
    const cookie = response.headers.get('set-cookie') ?? ''

    assert.equal(response.status, 200)
    assert.match(cookie, /^shelv_session=[\w-]{40,};/)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Strict/)
  })

  test('the cookie replaces the credentials on a request', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))
    seenByNavidrome.length = 0

    const response = await fetch(`${base}/rest/ping?f=json`, {
      headers: { cookie },
    })
    assert.equal(response.status, 200)

    const seen = seenByNavidrome.at(-1) ?? ''
    assert.match(seen, /^\/rest\/ping\?/)
    assert.match(seen, /u=vasco/)
    assert.match(seen, /t=good/)
    assert.match(seen, /s=salt/)
  })

  test('the cookie opens the protected routes, nothing else does', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))

    assert.equal(
      (await fetch(`${base}/api/lyrics/stats`, { headers: { cookie } })).status,
      200,
    )
    assert.equal(
      (
        await fetch(`${base}/api/lyrics/stats`, {
          headers: { cookie: 'shelv_session=made-up' },
        })
      ).status,
      401,
    )
  })

  test('only an administrator may change the server settings', async () => {
    const user = cookieOf(await login('vasco', 'good'))
    const admin = cookieOf(await login('admin', 'good'))
    const reset = (cookie: string) =>
      fetch(`${base}/api/lyrics/reset`, { method: 'POST', headers: { cookie } })

    assert.equal((await reset(user)).status, 403)
    assert.equal((await reset(admin)).status, 200)
  })

  test('after the logout the cookie does not work any more', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))

    const logout = await fetch(`${base}/api/logout`, {
      method: 'POST',
      headers: { cookie },
    })
    assert.equal(logout.status, 200)

    assert.equal(
      (await fetch(`${base}/api/lyrics/stats`, { headers: { cookie } })).status,
      401,
    )
  })

  test('too many wrong logins from one address are stopped', async () => {
    let last = 0
    for (let attempt = 0; attempt < 11; attempt++) {
      last = (await login('vasco', 'wrong', '10.9.9.9')).status
    }

    assert.equal(last, 429)
    // another address is not affected
    assert.equal((await login('vasco', 'good', '10.8.8.8')).status, 200)
  })
})
