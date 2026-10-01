import { strict as assert } from 'node:assert'
import { mkdtemp, readdir, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DiskCache } from './cache.ts'

test('the oldest files go when a kind is over its limit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shelv-cache-'))
  const cache = new DiskCache(dir, { images: 100, lyrics: 100 })
  const body = Buffer.alloc(30, 1)

  // five files of 30 bytes, "0" is the oldest
  for (let i = 0; i < 5; i++) {
    const key = DiskCache.key(String(i))
    await cache.put('images', key, body, 'image/png')
    const time = new Date(Date.now() - (5 - i) * 60_000)
    await utimes(join(dir, 'images', key.slice(0, 2), `${key}.bin`), time, time)
  }

  await cache.prune('images')

  const kept: string[] = []
  for (let i = 0; i < 5; i++) {
    if (await cache.get('images', DiskCache.key(String(i))))
      kept.push(String(i))
  }
  // 150 bytes down to at most 90
  assert.deepEqual(kept, ['2', '3', '4'])
})

test('a kind under its limit stays as it is', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shelv-cache-'))
  const cache = new DiskCache(dir, { images: 1000, lyrics: 1000 })

  await cache.put('images', DiskCache.key('a'), Buffer.alloc(30), 'image/png')
  await cache.put('lyrics', DiskCache.key('b'), Buffer.alloc(30), 'text/plain')
  await cache.prune('images')
  await cache.prune('lyrics')

  assert.ok(await cache.get('images', DiskCache.key('a')))
  assert.ok(await cache.get('lyrics', DiskCache.key('b')))
})

test('a kind that was never used can be pruned', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shelv-cache-'))

  await new DiskCache(dir).prune('images')
  assert.deepEqual(await readdir(dir), [])
})

test('the other kind is not touched', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shelv-cache-'))
  const cache = new DiskCache(dir, { images: 10, lyrics: 1000 })

  await cache.put('images', DiskCache.key('a'), Buffer.alloc(30), 'image/png')
  await cache.put('lyrics', DiskCache.key('b'), Buffer.alloc(30), 'text/plain')
  await cache.prune('images')

  assert.equal(await cache.get('images', DiskCache.key('a')), null)
  assert.ok(await cache.get('lyrics', DiskCache.key('b')))
})
