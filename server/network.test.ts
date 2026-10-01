import { strict as assert } from 'node:assert'
import { createServer, type Server } from 'node:http'
import { after, before, describe, test } from 'node:test'
import { classifyAddress, isAllowed } from './network.ts'
import { requestRadioUpstream } from './radio-upstream.ts'

test('addresses are told apart', () => {
  const kinds: Record<string, string> = {
    '8.8.8.8': 'public',
    '203.0.113.7': 'public',
    '2606:4700::1111': 'public',
    '10.0.0.5': 'private',
    '172.18.0.2': 'private',
    '172.32.0.1': 'public',
    '192.168.1.20': 'private',
    '127.0.0.1': 'private',
    '100.64.0.1': 'private',
    '::1': 'private',
    'fd12:3456::1': 'private',
    '::ffff:10.0.0.5': 'private',
    '::ffff:8.8.8.8': 'public',
    // the metadata service of a cloud, and what is not an address at all
    '169.254.169.254': 'blocked',
    '::ffff:169.254.169.254': 'blocked',
    'fe80::1': 'blocked',
    '0.0.0.0': 'blocked',
    '::': 'blocked',
    '224.0.0.1': 'blocked',
    'ff02::1': 'blocked',
    'not-an-address': 'blocked',
  }

  for (const [address, kind] of Object.entries(kinds)) {
    assert.equal(classifyAddress(address), kind, address)
  }
})

test('the first address decides if the home network is allowed', () => {
  const fromHome = { allowPrivate: null }
  assert.equal(isAllowed(fromHome, '192.168.1.20'), true)
  assert.equal(isAllowed(fromHome, '10.0.0.5'), true)
  assert.equal(isAllowed(fromHome, '8.8.8.8'), true)
  assert.equal(isAllowed(fromHome, '169.254.169.254'), false)

  const fromInternet = { allowPrivate: null }
  assert.equal(isAllowed(fromInternet, '8.8.8.8'), true)
  assert.equal(isAllowed(fromInternet, '192.168.1.20'), false)
  assert.equal(isAllowed(fromInternet, '127.0.0.1'), false)
  assert.equal(isAllowed(fromInternet, '172.18.0.2'), false)
  assert.equal(isAllowed(fromInternet, '1.1.1.1'), true)
})

describe('requests to foreign servers', () => {
  let server: Server
  let base: string

  before(async () => {
    server = createServer((req, res) => {
      if (req.url === '/to-metadata') {
        res.writeHead(302, { location: 'http://169.254.169.254/latest' })
        res.end()
      } else if (req.url === '/to-other') {
        res.writeHead(302, { location: '/music' })
        res.end()
      } else {
        res.writeHead(200, { 'content-type': 'audio/mpeg' })
        res.end('music')
      }
    })
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    )
    const address = server.address()
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  })

  after(() => new Promise<void>((resolve) => server.close(() => resolve())))

  test('a station in the home network works', async () => {
    const answer = await requestRadioUpstream(`${base}/music`)

    assert.equal(answer.status, 200)
    assert.equal(answer.allowPrivate, true)
    answer.body.resume()
  })

  test('a station that is called by name works as well', async () => {
    const port = new URL(base).port
    const answer = await requestRadioUpstream(`http://localhost:${port}/music`)

    assert.equal(answer.status, 200)
    answer.body.resume()
  })

  test('a redirect inside the home network is followed', async () => {
    const answer = await requestRadioUpstream(`${base}/to-other`)

    assert.equal(answer.status, 200)
    answer.body.resume()
  })

  test('what is only allowed on the internet does not reach the home network', async () => {
    await assert.rejects(
      requestRadioUpstream(`${base}/music`, { allowPrivate: false }),
      /not allowed/,
    )
    await assert.rejects(
      requestRadioUpstream(`http://localhost:${new URL(base).port}/music`, {
        allowPrivate: false,
      }),
      /not allowed/,
    )
  })

  test('the metadata service of a cloud is never reached', async () => {
    await assert.rejects(
      requestRadioUpstream(`${base}/to-metadata`),
      /not allowed/,
    )
    await assert.rejects(
      requestRadioUpstream('http://169.254.169.254/latest', {
        allowPrivate: true,
      }),
      /not allowed/,
    )
  })

  test('only http and https are followed', async () => {
    await assert.rejects(
      requestRadioUpstream('ftp://example.com/a'),
      /not allowed/,
    )
    await assert.rejects(
      requestRadioUpstream('file:///etc/passwd'),
      /not allowed/,
    )
  })
})
