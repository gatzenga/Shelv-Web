// Starts the real server against a pretend Navidrome and goes through the
// login, the session cookie and the protection of the routes.
import { strict as assert } from 'node:assert'
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtemp, stat } from 'node:fs/promises'
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
  let folder: string

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

    folder = await mkdtemp(join(tmpdir(), 'shelv-server-'))
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

  // The address of the visitor comes from Cloudflare, like in production
  async function login(
    user: string,
    token: string,
    address = '10.0.0.1',
    headers: Record<string, string> = {},
  ) {
    return fetch(`${base}/api/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': address,
        ...headers,
      },
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
    assert.doesNotMatch(cookie, /Secure/)
  })

  test('over https the cookie is Secure and bound to this host', async () => {
    const response = await login('vasco', 'good', '10.0.0.3', {
      'x-forwarded-proto': 'https',
    })
    const cookie = response.headers.get('set-cookie') ?? ''

    assert.match(cookie, /^__Host-shelv_session=[\w-]{40,};/)
    assert.match(cookie, /; Secure/)
    assert.match(cookie, /Path=\//)
    assert.doesNotMatch(cookie, /Domain/)
    assert.ok(response.headers.get('strict-transport-security'))

    // a cookie without the prefix, as another subdomain could set it, is not taken
    const plain = cookieOf(await login('vasco', 'good', '10.0.0.4'))
    const stats = await fetch(`${base}/api/lyrics/stats`, {
      headers: { cookie: plain, 'x-forwarded-proto': 'https' },
    })
    assert.equal(stats.status, 401)
  })

  test('the file with the sessions can only be read by its owner', async () => {
    await login('vasco', 'good', '10.0.0.5')
    const info = await stat(join(folder, 'config', 'sessions.json'))

    assert.equal(info.mode & 0o777, 0o600)
  })

  test('the login only takes json and a body that is an object', async () => {
    const send = (body: string, type?: string) =>
      fetch(`${base}/api/login`, {
        method: 'POST',
        headers: type ? { 'content-type': type } : {},
        body,
      })

    assert.equal((await send('{}')).status, 415)
    assert.equal((await send('{}', 'text/plain')).status, 415)
    assert.equal((await send('null', 'application/json')).status, 400)
    assert.equal((await send('[1]', 'application/json')).status, 400)
    assert.equal((await send('{bad', 'application/json')).status, 400)
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
      last = (await login('mallory', 'wrong', '10.9.9.9')).status
    }

    assert.equal(last, 429)
    // another address is not affected
    assert.equal((await login('vasco', 'good', '10.8.8.8')).status, 200)
  })

  test('an address made up in X-Forwarded-For does not help', async () => {
    let last = 0
    for (let attempt = 0; attempt < 11; attempt++) {
      // the first entries are written by the visitor, the last by the proxy
      last = (
        await fetch(`${base}/api/login`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': `${attempt}.1.1.1, 10.7.7.7`,
          },
          body: JSON.stringify({ u: 'mallory2', t: 'wrong', s: 'salt' }),
        })
      ).status
    }

    assert.equal(last, 429)
  })

  test('one user can not be tried from many addresses either', async () => {
    let last = 0
    for (let attempt = 0; attempt < 51; attempt++) {
      last = (await login('victim', 'wrong', `10.6.${attempt}.1`)).status
    }

    assert.equal(last, 429)
    assert.equal((await login('victim', 'wrong', '10.6.200.1')).status, 429)
  })

  test('a login that works is not held against the address', async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      assert.equal((await login('vasco', 'good', '10.5.5.5')).status, 200)
    }
  })

  test('credentials on the address are ignored, only the session counts', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))
    seenByNavidrome.length = 0

    const anonymous = await fetch(
      `${base}/rest/getAlbumList2?u=vasco&t=good&s=salt&type=newest`,
    )
    assert.equal(anonymous.status, 401)
    assert.deepEqual(seenByNavidrome, [])

    for (const path of [
      '/api/mix?u=vasco&t=good&s=salt',
      '/api/insights?p=x',
    ]) {
      assert.equal((await fetch(`${base}${path}`)).status, 401, path)
    }

    // the user of the session wins over the one on the address
    await fetch(`${base}/rest/getAlbumList2?u=admin&t=good&s=other&p=x`, {
      headers: { cookie },
    })
    const seen = seenByNavidrome.at(-1) ?? ''
    assert.match(seen, /u=vasco/)
    assert.doesNotMatch(seen, /admin|other|p=x/)
  })

  test('without a login only what the login page needs gets through', async () => {
    seenByNavidrome.length = 0

    assert.equal((await fetch(`${base}/rest/ping.view?v=1.16.0`)).status, 200)
    assert.equal(
      (await fetch(`${base}/rest/getOpenSubsonicExtensions`)).status,
      200,
    )
    assert.equal((await fetch(`${base}/rest/getUser?username=a`)).status, 401)
    assert.equal((await fetch(`${base}/rest/stream?id=1`)).status, 401)
    assert.equal(seenByNavidrome.length, 2)
    assert.ok(seenByNavidrome.every((seen) => !/[?&]u=/.test(seen)))
  })

  test('another site can not use the session', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))
    const get = (path: string, headers: Record<string, string>) =>
      fetch(`${base}${path}`, { headers: { cookie, ...headers } })

    assert.equal((await get('/api/lyrics/stats', {})).status, 200)
    assert.equal(
      (await get('/api/lyrics/stats', { 'sec-fetch-site': 'same-origin' }))
        .status,
      200,
    )
    for (const site of ['cross-site', 'same-site']) {
      assert.equal(
        (await get('/api/lyrics/stats', { 'sec-fetch-site': site })).status,
        401,
        site,
      )
    }
  })

  test('an image or a link can only load media with the session', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))
    const load = (path: string, destination: string) =>
      fetch(`${base}${path}`, {
        headers: {
          cookie,
          'sec-fetch-site': 'same-origin',
          'sec-fetch-dest': destination,
        },
      })

    assert.equal((await load('/rest/getCoverArt?id=1', 'image')).status, 200)
    assert.equal((await load('/rest/stream?id=1', 'audio')).status, 200)
    // somebody planted <img src="/rest/deletePlaylist?id=1">
    assert.equal((await load('/rest/deletePlaylist?id=1', 'image')).status, 401)
    assert.equal((await load('/api/lyrics/reset', 'document')).status, 403)
    assert.equal((await load('/rest/deletePlaylist?id=1', 'empty')).status, 200)
  })

  test('answers for a user are never kept by a cache in between', async () => {
    const cookie = cookieOf(await login('vasco', 'good'))
    const response = await fetch(`${base}/api/lyrics/stats`, {
      headers: { cookie },
    })

    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
    assert.equal(response.headers.get('vary'), 'Cookie')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(response.headers.get('permissions-policy'))
  })

  test('an address with another host is refused', async () => {
    const response = await fetch(`${base}//evil.example/api/health`)

    assert.equal(response.status, 400)
  })
})
