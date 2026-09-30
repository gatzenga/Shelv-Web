import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
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
export class DiskCache {
  readonly dir: string

  constructor(dir: string) {
    this.dir = dir
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
