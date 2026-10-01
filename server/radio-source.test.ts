import { strict as assert } from 'node:assert'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { test } from 'node:test'
import { resolveStream } from './radio-source.ts'

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
) {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('missing server address')
  }

  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    await run(baseUrl)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

test('resolveStream keeps original direct URL and follows redirects per request', async () => {
  await withServer((req, res) => {
    if (req.url?.startsWith('/direct')) {
      res.statusCode = 302
      res.setHeader('location', '/audio?token=dynamic')
      res.end()
      return
    }

    res.statusCode = 200
    res.setHeader('content-type', 'audio/mpeg')
    res.end('audio')
  }, async (baseUrl) => {
    const streamUrl = `${baseUrl}/direct?seed=1`
    const stream = await resolveStream(streamUrl)

    assert.equal(stream.kind, 'direct')
    assert.equal(stream.url, streamUrl)
  })
})

test('resolveStream keeps original HLS entry URL after redirect detection', async () => {
  await withServer((req, res) => {
    if (req.url?.startsWith('/entry')) {
      res.statusCode = 302
      res.setHeader('location', '/playlist.m3u8?token=dynamic')
      res.end()
      return
    }

    res.statusCode = 200
    res.setHeader('content-type', 'application/vnd.apple.mpegurl')
    res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6,\nsegment.ts\n')
  }, async (baseUrl) => {
    const streamUrl = `${baseUrl}/entry?seed=2`
    const stream = await resolveStream(streamUrl)

    assert.equal(stream.kind, 'hls')
    assert.equal(stream.url, streamUrl)
  })
})
