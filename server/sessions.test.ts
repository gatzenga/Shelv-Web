import { strict as assert } from 'node:assert'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { LoginLimiter, parseCookies, SessionStore } from './sessions.ts'

const credentials = { u: 'vasco', t: 'token', s: 'salt' }

test('parseCookies reads several cookies', () => {
  const cookies = parseCookies('a=1; shelv_session=abc=; b=2')

  assert.equal(cookies.get('a'), '1')
  assert.equal(cookies.get('shelv_session'), 'abc=')
  assert.equal(cookies.get('b'), '2')
  assert.equal(parseCookies(undefined).size, 0)
})

test('a session gives back the credentials and ends on delete', async () => {
  const store = new SessionStore()
  const id = await store.create(credentials)

  assert.deepEqual(store.get(id), credentials)
  assert.equal(store.get('another-id'), undefined)
  assert.equal(store.get(undefined), undefined)

  await store.delete(id)
  assert.equal(store.get(id), undefined)
})

test('the ids are different and long', async () => {
  const store = new SessionStore()
  const first = await store.create(credentials)
  const second = await store.create(credentials)

  assert.notEqual(first, second)
  assert.ok(first.length >= 40)
})

test('sessions survive a restart when they are kept in a file', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'shelv-sessions-'))
  const file = join(folder, 'sessions.json')

  const before = new SessionStore(file)
  const id = await before.create(credentials)

  const after = new SessionStore(file)
  await after.load()
  assert.deepEqual(after.get(id), credentials)

  await after.delete(id)
  assert.equal(Object.keys(JSON.parse(await readFile(file, 'utf-8'))).length, 0)
})

test('an expired session is not valid', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'shelv-sessions-'))
  const file = join(folder, 'sessions.json')

  const store = new SessionStore(file)
  const id = await store.create(credentials)

  const originalNow = Date.now
  Date.now = () => originalNow() + 31 * 24 * 60 * 60 * 1000
  try {
    assert.equal(store.get(id), undefined)
  } finally {
    Date.now = originalNow
  }
})

test('the login limiter blocks after too many failures and resets', () => {
  const limiter = new LoginLimiter()

  for (let i = 0; i < 9; i++) limiter.fail('1.2.3.4')
  assert.equal(limiter.isBlocked('1.2.3.4'), false)

  limiter.fail('1.2.3.4')
  assert.equal(limiter.isBlocked('1.2.3.4'), true)
  assert.equal(limiter.isBlocked('5.6.7.8'), false)

  limiter.reset('1.2.3.4')
  assert.equal(limiter.isBlocked('1.2.3.4'), false)
})
