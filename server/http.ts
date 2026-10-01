import { createReadStream } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

// Headers the browser may send that are relevant for the upstream servers
const forwardedRequestHeaders = [
  'accept',
  'accept-language',
  'content-type',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'lrclib-client',
  'range',
  'user-agent',
]

// Headers from the upstream servers the browser needs to see
const forwardedResponseHeaders = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'expires',
  'icy-br',
  'icy-description',
  'icy-genre',
  'icy-metaint',
  'icy-name',
  'icy-notice1',
  'icy-notice2',
  'icy-pub',
  'icy-url',
  'last-modified',
  'x-total-count',
]

export function upstreamHeaders(req: IncomingMessage): Headers {
  const headers = new Headers()

  for (const name of forwardedRequestHeaders) {
    const value = req.headers[name]
    if (typeof value === 'string') headers.set(name, value)
  }

  // Keep bodies uncompressed so content-length and ranges stay valid
  headers.set('accept-encoding', 'identity')

  const clientIp = req.socket.remoteAddress
  if (clientIp) headers.set('x-forwarded-for', clientIp)

  return headers
}

export function copyUpstreamHeaders(res: ServerResponse, upstream: Response) {
  for (const name of forwardedResponseHeaders) {
    const value = upstream.headers.get(name)
    if (value !== null) res.setHeader(name, value)
  }
}

export function requestBody(req: IncomingMessage) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined

  return Readable.toWeb(req) as ReadableStream<Uint8Array>
}

// A small body as text, refused when it is larger than the limit
export async function readBody(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('body too large')
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

// Aborts the upstream request as soon as the browser goes away,
// e.g. when skipping a song while it is still streaming
export function abortOnClose(res: ServerResponse): AbortSignal {
  const controller = new AbortController()

  res.on('close', () => {
    if (!res.writableFinished) controller.abort()
  })

  return controller.signal
}

export async function pipeUpstream(
  req: IncomingMessage,
  res: ServerResponse,
  upstream: Response,
  options: { live?: boolean } = {},
) {
  res.statusCode = upstream.status
  copyUpstreamHeaders(res, upstream)

  // A live radio stream has no fixed length
  if (options.live) res.removeHeader('content-length')

  if (!upstream.body || req.method === 'HEAD') {
    upstream.body?.cancel().catch(() => {})
    res.end()
    return
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body as NodeReadableStream), res)
  } catch (error) {
    if (!isAbortError(error)) throw error
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)

  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('content-length', Buffer.byteLength(payload))
  res.end(payload)
}

export function sendText(
  res: ServerResponse,
  status: number,
  body: string,
  contentType = 'text/plain; charset=utf-8',
) {
  res.statusCode = status
  res.setHeader('content-type', contentType)
  res.setHeader('content-length', Buffer.byteLength(body))
  res.end(body)
}

export function sendBuffer(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
  contentType: string,
) {
  res.statusCode = 200
  res.setHeader('content-type', contentType)
  res.setHeader('content-length', body.length)
  res.end(req.method === 'HEAD' ? undefined : body)
}

interface FileInfo {
  path: string
  size: number
  contentType: string
  cacheControl?: string
}

function parseRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, startText, endText] = match
  let start: number
  let end: number

  if (startText === '') {
    // suffix range: the last N bytes
    const length = Number(endText)
    if (!length) return null
    start = Math.max(size - length, 0)
    end = size - 1
  } else {
    start = Number(startText)
    end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1)
  }

  if (start > end || start >= size) return null

  return { start, end }
}

// Serves a file from disk with support for HTTP range requests,
// which the audio element needs for seeking
export async function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  file: FileInfo,
) {
  res.setHeader('content-type', file.contentType)
  res.setHeader('accept-ranges', 'bytes')
  if (file.cacheControl) res.setHeader('cache-control', file.cacheControl)

  const rangeHeader = req.headers.range
  let start = 0
  let end = file.size - 1

  if (rangeHeader) {
    const range = parseRange(rangeHeader, file.size)

    if (!range) {
      res.statusCode = 416
      res.setHeader('content-range', `bytes */${file.size}`)
      res.end()
      return
    }

    start = range.start
    end = range.end
    res.statusCode = 206
    res.setHeader('content-range', `bytes ${start}-${end}/${file.size}`)
  } else {
    res.statusCode = 200
  }

  res.setHeader('content-length', end - start + 1)

  if (req.method === 'HEAD' || file.size === 0) {
    res.end()
    return
  }

  try {
    await pipeline(createReadStream(file.path, { start, end }), res)
  } catch (error) {
    if (!isAbortError(error)) throw error
  }
}

export function isAbortError(error: unknown) {
  if (!(error instanceof Error)) return false

  const code = (error as NodeJS.ErrnoException).code

  return (
    error.name === 'AbortError' ||
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE'
  )
}

// A boolean option the browser sends with a request, the default applies
// when it is missing
export function readBooleanParam(
  params: URLSearchParams,
  name: string,
  fallback: boolean,
): boolean {
  const value = params.get(name)

  return value === null ? fallback : value === 'true'
}
