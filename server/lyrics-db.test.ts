import { strict as assert } from 'node:assert'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { LyricsDatabase, type LyricsRecord } from './lyrics-db.ts'

function record(songId: string, plainText: string): LyricsRecord {
  return {
    songId,
    serverId: 'default',
    source: 'lrclib',
    plainText,
    syncedLrc: null,
    isSynced: false,
    isInstrumental: false,
    language: null,
    fetchedAt: Date.now() / 1000,
    songTitle: `title ${songId}`,
    artistName: 'artist',
    albumId: null,
    coverArt: null,
    songDuration: 200,
  }
}

async function databaseWith(texts: string[]) {
  const database = new LyricsDatabase(
    await mkdtemp(join(tmpdir(), 'shelv-lyrics-')),
  )
  texts.forEach((text, index) => {
    database.saveLyrics(record(String(index), text))
  })

  return database
}

test('the search finds a text without caring for upper and lower case', async () => {
  const database = await databaseWith(['Hello World', 'something else'])
  const found = database.searchLyrics('hello', 'default')

  assert.deepEqual(
    found.map((item) => item.songId),
    ['0'],
  )
  assert.equal(found[0].snippet, 'Hello World')
})

test('% and _ in a search are letters, not wildcards', async () => {
  const database = await databaseWith(['100% sure', 'some words', 'a_b'])

  assert.deepEqual(
    database.searchLyrics('%%', 'default').map((item) => item.songId),
    [],
  )
  assert.deepEqual(
    database.searchLyrics('0%', 'default').map((item) => item.songId),
    ['0'],
  )
  assert.deepEqual(
    database.searchLyrics('a_', 'default').map((item) => item.songId),
    ['2'],
  )
  assert.deepEqual(
    database.searchLyrics('so_e', 'default').map((item) => item.songId),
    [],
  )
})

test('a search brings back no more than the limit', async () => {
  const database = await databaseWith(
    Array.from({ length: 20 }, (_, i) => `la la la ${i}`),
  )

  assert.equal(database.searchLyrics('la la', 'default', 5).length, 5)
})
