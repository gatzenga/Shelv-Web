import type { IncomingMessage, RequestOptions, ServerResponse } from 'node:http'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { pipeline } from 'node:stream/promises'
import { guardedLookup, isAllowed, type Reach } from './network.ts'

export interface RadioUpstreamResponse {
  ok: boolean
  status: number
  url: string
  // whether the request was in the home network, see network.ts
  allowPrivate: boolean
  headers: IncomingHttpHeaders
  body: IncomingMessage
}

interface RadioUpstreamRequest {
  method?: string
  headers?: Record<string, string>
  signal?: AbortSignal
  maxRedirects?: number
  // set for what a playlist names: it may only go where the playlist itself was
  allowPrivate?: boolean
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
  reach: Reach,
  signal?: AbortSignal,
) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      reject(new Error(`${url.protocol} is not allowed`))
      return
    }

    // A name is checked when it is looked up, an address is checked here
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) !== 0 && !isAllowed(reach, host)) {
      reject(new Error(`${host} is not allowed`))
      return
    }

    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
      lookup: guardedLookup(reach),
      // A connection that is kept for the next request would skip the check
      agent: false,
      // stations answer with "ICY 200 OK" and the like
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
  const reach: Reach = { allowPrivate: options.allowPrivate ?? null }

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const upstream = await performRequest(
      new URL(currentUrl),
      currentMethod,
      options.headers ?? {},
      reach,
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
      allowPrivate: reach.allowPrivate ?? false,
      headers: upstream.headers,
      body: upstream,
    }
  }

  throw new Error('too many redirects')
}

export async function readRadioUpstreamBuffer(
  upstream: RadioUpstreamResponse,
  maxBytes: number,
) {
  let size = 0
  const chunks: Buffer[] = []

  for await (const chunk of upstream.body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('upstream body too large')
    chunks.push(buffer)
  }

  return Buffer.concat(chunks)
}

export async function readRadioUpstreamText(
  upstream: RadioUpstreamResponse,
  maxBytes = 1024 * 1024,
) {
  return (await readRadioUpstreamBuffer(upstream, maxBytes)).toString('utf8')
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
