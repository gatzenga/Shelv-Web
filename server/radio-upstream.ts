import type { IncomingMessage, RequestOptions, ServerResponse } from 'node:http'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pipeline } from 'node:stream/promises'

export interface RadioUpstreamResponse {
  ok: boolean
  status: number
  url: string
  headers: IncomingHttpHeaders
  body: IncomingMessage
}

interface RadioUpstreamRequest {
  method?: string
  headers?: Record<string, string>
  signal?: AbortSignal
  maxRedirects?: number
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308])

function createAbortError() {
  const error = new Error('request aborted')
  error.name = 'AbortError'
  return error
}

function asString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function performRequest(
  url: URL,
  method: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
      insecureHTTPParser: true,
    }
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = request(options, (res) => resolve(res))
    const abort = () => req.destroy(createAbortError())

    if (signal) {
      if (signal.aborted) {
        abort()
        return
      }
      signal.addEventListener('abort', abort, { once: true })
      req.once('close', () => signal.removeEventListener('abort', abort))
    }

    req.once('error', reject)
    req.end()
  })
}

export async function requestRadioUpstream(
  sourceUrl: string,
  options: RadioUpstreamRequest = {},
): Promise<RadioUpstreamResponse> {
  const method = options.method ?? 'GET'
  let currentUrl = sourceUrl
  let currentMethod = method
  const maxRedirects = options.maxRedirects ?? 10

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const upstream = await performRequest(
      new URL(currentUrl),
      currentMethod,
      options.headers ?? {},
      options.signal,
    )
    const status = upstream.statusCode ?? 0
    const location = asString(upstream.headers.location)

    if (
      location &&
      redirectStatusCodes.has(status) &&
      redirect < maxRedirects
    ) {
      upstream.resume()
      currentUrl = new URL(location, currentUrl).toString()
      if (
        status === 303 &&
        currentMethod !== 'GET' &&
        currentMethod !== 'HEAD'
      ) {
        currentMethod = 'GET'
      }
      continue
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      url: currentUrl,
      headers: upstream.headers,
      body: upstream,
    }
  }

  throw new Error('too many redirects')
}

export async function readRadioUpstreamText(
  upstream: RadioUpstreamResponse,
  maxBytes = 1024 * 1024,
) {
  let size = 0
  const chunks: Buffer[] = []

  for await (const chunk of upstream.body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('upstream body too large')
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

export async function pipeRadioUpstream(
  req: IncomingMessage,
  res: ServerResponse,
  upstream: RadioUpstreamResponse,
  options: { live?: boolean } = {},
) {
  res.statusCode = upstream.status

  if (options.live) res.removeHeader('content-length')

  if (req.method === 'HEAD') {
    upstream.body.resume()
    res.end()
    return
  }

  await pipeline(upstream.body, res)
}
