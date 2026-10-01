import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { sendBuffer, sendFile, sendJson } from './http.ts'

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function cacheControlFor(relativePath: string) {
  // Vite puts a content hash into every file name below assets/
  if (relativePath.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable'
  }

  return 'public, max-age=86400'
}

async function fileSize(filePath: string) {
  try {
    const info = await stat(filePath)
    return info.isFile() ? info.size : null
  } catch {
    return null
  }
}

const configScriptTag = '<script src="./env-config.js"></script>'

function escapeScript(configScript: string) {
  return configScript.replace(/</g, '\\u003c')
}

// What the page may load and run. The only script of the page itself is the
// config, named by its hash, anything else has to come from this server. So a
// text that finds its way into the page can not run, call, or load anything.
export function pageSecurityPolicy(configScript: string) {
  const hash = createHash('sha256')
    .update(escapeScript(configScript))
    .digest('base64')

  return [
    "default-src 'none'",
    `script-src 'self' 'sha256-${hash}'`,
    // the components set their sizes and positions with style attributes
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
  ].join('; ')
}

// The config is written into the page itself instead of loading
// /env-config.js: reverse proxies often cache every .js file for a while
// (ignoring no-store), which kept browsers on an old config
export function inlineConfig(html: string, configScript: string) {
  const safeScript = escapeScript(configScript)

  // a function, so that a $ in the config is not read as a pattern
  return html.replace(configScriptTag, () => `<script>${safeScript}</script>`)
}

export function createStaticHandler(distDir: string, configScript: string) {
  const root = path.resolve(distDir)
  const indexFile = path.join(root, 'index.html')
  const policy = pageSecurityPolicy(configScript)

  async function sendIndex(req: IncomingMessage, res: ServerResponse) {
    let html: string

    try {
      html = await readFile(indexFile, 'utf8')
    } catch {
      sendJson(res, 500, { error: 'frontend build is missing' })
      return
    }

    res.setHeader('cache-control', 'no-store')
    res.setHeader('content-security-policy', policy)
    sendBuffer(
      req,
      res,
      Buffer.from(inlineConfig(html, configScript)),
      contentTypes['.html'],
    )
  }

  return async function handleStatic(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }

    const requested = path.resolve(root, `.${decodeURIComponent(url.pathname)}`)
    const isInsideRoot = requested.startsWith(`${root}${path.sep}`)

    if (isInsideRoot) {
      const size = await fileSize(requested)

      if (size !== null && requested === indexFile) {
        await sendIndex(req, res)
        return
      }

      if (size !== null) {
        const relativePath = path
          .relative(root, requested)
          .split(path.sep)
          .join('/')
        const extension = path.extname(requested).toLowerCase()

        await sendFile(req, res, {
          path: requested,
          size,
          contentType: contentTypes[extension] ?? 'application/octet-stream',
          cacheControl: cacheControlFor(relativePath),
        })
        return
      }
    }

    // Missing files with an extension are real 404s,
    // everything else is a client side route of the single page app
    if (path.extname(url.pathname) !== '') {
      sendJson(res, 404, { error: 'not found' })
      return
    }

    await sendIndex(req, res)
  }
}
