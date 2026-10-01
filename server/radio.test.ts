// Starts the real server with a pretend Navidrome and a pretend radio station
// and looks at what leaves the server: hostile content from a station must
// not run as a page of the app.
import { strict as assert } from 'node:assert'
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

function listen(server: Server) {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })
}

describe('radio', () => {
  let navidrome: Server
  let station: Server
  let shelv: ChildProcess
  let base: string
  let stationBase: string

  before(async () => {
    station = createServer((req, res) => {
      const path = req.url ?? ''

      if (path === '/hls.m3u8') {
        res.setHeader('content-type', 'application/vnd.apple.mpegurl')
        res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4,\nsegment.ts\n')
      } else if (path === '/segment.ts') {
        // a segment that is a page with a script
        res.setHeader('content-type', 'text/html')
        res.end('<script>alert(1)</script>')
      } else if (path === '/direct') {
        res.setHeader('content-type', 'text/html')
        res.end('<script>alert(1)</script>')
      } else if (path === '/art.svg') {
        res.setHeader('content-type', 'image/svg+xml')
        res.end(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        )
      } else if (path === '/art.png') {
        res.setHeader('content-type', 'image/png')
        res.end('png')
      } else if (path.startsWith('/azuracast')) {
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            station: { name: 'Station', shortcode: 'station' },
            now_playing: {
              song: {
                title: 'Song',
                artist: 'Artist',
                art: `${stationBase}/art.${path.endsWith('png') ? 'png' : 'svg'}`,
              },
            },
            is_online: true,
          }),
        )
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    stationBase = `http://127.0.0.1:${await listen(station)}`

    navidrome = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
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
      if (url.pathname.endsWith('getInternetRadioStations')) {
        body.internetRadioStations = {
          internetRadioStation: [
            { id: '1', name: 'HLS', streamUrl: `${stationBase}/hls.m3u8` },
            { id: '2', name: 'Direct', streamUrl: `${stationBase}/direct` },
          ],
        }
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ 'subsonic-response': body }))
    })
    const navidromePort = await listen(navidrome)

    const probe = createServer()
    const port = await listen(probe)
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const folder = await mkdtemp(join(tmpdir(), 'shelv-radio-'))
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
        if ((await fetch(`${base}/api/health`)).ok) return
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('the server did not start')
  })

  after(async () => {
    shelv.kill()
    await Promise.all(
      [navidrome, station].map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    )
  })

  async function cookieFor(user: string) {
    const response = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ u: user, t: 'good', s: 'salt' }),
    })

    return response.headers.get('set-cookie')?.split(';')[0] ?? ''
  }

  test('a segment that is a page is handed out as a plain download', async () => {
    const cookie = await cookieFor('vasco')
    const playlist = await fetch(`${base}/api/radio/stream?id=1`, {
      headers: { cookie },
    })
    const text = await playlist.text()
    const link = text
      .split('\n')
      .find((line) => line.startsWith('/api/radio/hls'))

    assert.ok(link, text)
    assert.match(link, /lan=1/)

    // the link works without a login, the signature is the proof
    const segment = await fetch(`${base}${link}`)

    assert.equal(segment.status, 200)
    assert.equal(
      segment.headers.get('content-type'),
      'application/octet-stream',
    )
    assert.equal(segment.headers.get('x-content-type-options'), 'nosniff')
    assert.match(
      segment.headers.get('content-security-policy') ?? '',
      /sandbox/,
    )
  })

  test('a link of a segment can not be changed', async () => {
    const cookie = await cookieFor('vasco')
    const playlist = await fetch(`${base}/api/radio/stream?id=1`, {
      headers: { cookie },
    })
    const link = (await playlist.text())
      .split('\n')
      .find((line) => line.startsWith('/api/radio/hls'))
    assert.ok(link)

    const changed = [
      link.replace('lan=1', 'lan=0'),
      link.replace(/src=[^&]*/, 'src=http%3A%2F%2F127.0.0.1%3A1%2Fx'),
      link.replace(/sig=[^&]*/, 'sig=abc'),
    ]
    for (const path of changed) {
      assert.equal((await fetch(`${base}${path}`)).status, 403, path)
    }
  })

  test('a stream that is a page is handed out as a plain download', async () => {
    const cookie = await cookieFor('vasco')
    const stream = await fetch(`${base}/api/radio/stream?id=2`, {
      headers: { cookie },
    })

    assert.equal(stream.headers.get('content-type'), 'application/octet-stream')
    assert.match(stream.headers.get('content-security-policy') ?? '', /sandbox/)
  })

  test('only a picture is passed on as artwork', async () => {
    const admin = await cookieFor('admin')

    // the answers of the station are kept for a moment, so two addresses
    async function artwork(kind: 'svg' | 'png') {
      const settings = await fetch(`${base}/api/radio/settings?id=1`, {
        method: 'PUT',
        headers: { cookie: admin, 'content-type': 'application/json' },
        body: JSON.stringify({
          useAzuraCastApi: true,
          apiUrl: `${stationBase}/azuracast?${kind}`,
          showSongCover: true,
        }),
      })
      assert.equal(settings.status, 200)

      const nowPlaying = await fetch(`${base}/api/radio/nowplaying?id=1`, {
        headers: { cookie: admin },
      })
      const { artworkUrl } = (await nowPlaying.json()) as { artworkUrl: string }

      return fetch(`${base}${artworkUrl}`)
    }

    assert.equal((await artwork('svg')).status, 404)

    const picture = await artwork('png')
    assert.equal(picture.status, 200)
    assert.equal(picture.headers.get('content-type'), 'image/png')
  })
})
