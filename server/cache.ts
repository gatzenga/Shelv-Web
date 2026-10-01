import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

export type CacheKind = 'images' | 'lyrics'

interface CacheMeta {
  contentType: string
}

export interface CacheEntry {
  path: string
  size: number
  contentType: string
}

// Stores responses on disk (the mounted cache volume), one folder per kind:
//   <dir>/<kind>/<first two hash chars>/<hash>.bin   the body
//   <dir>/<kind>/<first two hash chars>/<hash>.json  its content type
// The most a kind may take on the disk, the oldest files go first. Whoever
// has a login may fill the cache with requests, so it needs a limit.
const defaultLimits: Record<CacheKind, number> = {
  images: 2 * 1024 * 1024 * 1024,
  lyrics: 256 * 1024 * 1024,
}
const pruneAfterBytes = 32 * 1024 * 1024

export class DiskCache {
  readonly dir: string
  private readonly limits: Record<CacheKind, number>
  private written: Record<CacheKind, number> = { images: 0, lyrics: 0 }
  private pruning = new Set<CacheKind>()

  constructor(dir: string, limits: Record<CacheKind, number> = defaultLimits) {
    this.dir = dir
    this.limits = limits
  }

  static key(parts: string) {
    return createHash('sha256').update(parts).digest('hex')
  }

  private paths(kind: CacheKind, key: string) {
    const folder = path.join(this.dir, kind, key.slice(0, 2))

    return {
      folder,
      body: path.join(folder, `${key}.bin`),
      meta: path.join(folder, `${key}.json`),
    }
  }

  async get(kind: CacheKind, key: string): Promise<CacheEntry | null> {
    const paths = this.paths(kind, key)

    try {
      const [meta, info] = await Promise.all([
        readFile(paths.meta, 'utf8'),
        stat(paths.body),
      ])
      const { contentType } = JSON.parse(meta) as CacheMeta

      return { path: paths.body, size: info.size, contentType }
    } catch {
      return null
    }
  }

  async put(kind: CacheKind, key: string, body: Buffer, contentType: string) {
    const paths = this.paths(kind, key)
    const tmp = `${paths.body}.${randomUUID()}.tmp`

    await mkdir(paths.folder, { recursive: true })

    try {
      await writeFile(tmp, body)
      await this.commit(paths, tmp, contentType)
    } catch (error) {
      await rm(tmp, { force: true })
      throw error
    }

    this.written[kind] += body.length
    if (this.written[kind] >= pruneAfterBytes) {
      this.written[kind] = 0
      this.prune(kind).catch(() => {})
    }
  }

  // Removes the oldest files of a kind until it is below 90% of its limit
  async prune(kind: CacheKind) {
    if (this.pruning.has(kind)) return
    this.pruning.add(kind)

    try {
      const files: { name: string; size: number; time: number }[] = []
      const root = path.join(this.dir, kind)

      for (const folder of await readdir(root).catch(() => [])) {
        for (const file of await readdir(path.join(root, folder)).catch(
          () => [],
        )) {
          if (!file.endsWith('.bin')) continue

          const name = path.join(root, folder, file.slice(0, -'.bin'.length))
          const info = await stat(`${name}.bin`).catch(() => null)
          if (info) files.push({ name, size: info.size, time: info.mtimeMs })
        }
      }

      let total = files.reduce((sum, file) => sum + file.size, 0)
      if (total <= this.limits[kind]) return

      files.sort((a, b) => a.time - b.time)
      for (const file of files) {
        if (total <= this.limits[kind] * 0.9) break

        await rm(`${file.name}.bin`, { force: true })
        await rm(`${file.name}.json`, { force: true })
        total -= file.size
      }
    } finally {
      this.pruning.delete(kind)
    }
  }

  private async commit(
    paths: ReturnType<DiskCache['paths']>,
    tmp: string,
    contentType: string,
  ) {
    const meta: CacheMeta = { contentType }

    await writeFile(paths.meta, JSON.stringify(meta))
    await rename(tmp, paths.body)
  }
}
