import { strict as assert } from 'node:assert'
import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfig } from './config.ts'
import { LastFMService } from './lastfm.ts'
import { PendingApproval } from './lastfm-approval.ts'
import type { LastFMClient } from './lastfm-client.ts'

test('only the token that was asked for is taken', () => {
  const approval = new PendingApproval()
  assert.equal(approval.check('anything'), 'unknown')

  approval.start('token-1')
  assert.equal(approval.check('token-1'), 'open')
  assert.equal(approval.check('token-2'), 'unknown')
  assert.equal(approval.check(''), 'unknown')

  approval.finish()
  assert.equal(approval.check('token-1'), 'done')

  approval.start('token-3')
  assert.equal(approval.check('token-1'), 'unknown')
})

test('a token runs out after ten minutes', () => {
  const approval = new PendingApproval()
  approval.start('token-1')

  const originalNow = Date.now
  Date.now = () => originalNow() + 11 * 60 * 1000
  try {
    assert.equal(approval.check('token-1'), 'unknown')
  } finally {
    Date.now = originalNow
  }
})

async function serviceWithFakeLastfm() {
  const folder = await mkdtemp(join(tmpdir(), 'shelv-lastfm-'))
  process.env.NAVIDROME_URL = 'http://127.0.0.1:1'
  process.env.LASTFM_API = 'key'
  process.env.LASTFM_SECRET = 'secret'
  process.env.CONFIG_DIR = join(folder, 'config')
  process.env.LOGS_DIR = join(folder, 'logs')

  const service = new LastFMService(loadConfig())
  await service.init()

  const asked: string[] = []
  const client = (service as unknown as { client: LastFMClient | null }).client
  assert.ok(client)
  client.requestToken = async () => 'real-token'
  client.requestSession = async (token: string) => {
    asked.push(token)
    return { sessionKey: 'session-key', username: 'vasco' }
  }

  return { service, asked, folder }
}

test('Last.fm is only asked about the token of the administrator', async () => {
  const { service, asked } = await serviceWithFakeLastfm()

  // somebody calls the open page without any approval going on
  assert.equal(await service.completeAuthorization('made-up'), false)
  assert.deepEqual(asked, [])
  assert.equal(service.getStatus().state, 'notConnected')

  await service.beginAuthorization('https://music.example.com/callback')
  assert.equal(await service.completeAuthorization('made-up'), false)
  assert.deepEqual(asked, [])
  assert.equal(service.getStatus().problem, null)

  assert.equal(await service.completeAuthorization('real-token'), true)
  assert.deepEqual(asked, ['real-token'])
  assert.equal(service.getStatus().state, 'connected')
})

test('the poll and the page of Last.fm can both bring the token', async () => {
  const { service, asked } = await serviceWithFakeLastfm()

  await service.beginAuthorization('https://music.example.com/callback')
  assert.equal(await service.completeAuthorization('real-token'), true)
  assert.equal(await service.completeAuthorization('real-token'), true)
  assert.deepEqual(asked, ['real-token'])
})

test('the session of Last.fm is only for the user of the container', async () => {
  const { service, folder } = await serviceWithFakeLastfm()

  await service.beginAuthorization('https://music.example.com/callback')
  await service.completeAuthorization('real-token')

  const info = await stat(join(folder, 'config', 'lastfm.json'))
  assert.equal(info.mode & 0o777, 0o600)
})
