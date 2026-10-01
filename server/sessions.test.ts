import { strict as assert } from 'node:assert'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  LoginLimiter,
  parseCookies,
  SessionStore,
  sessionCookieName,
} from './sessions.ts'

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

test('a user has at most ten sessions, the oldest one goes first', async () => {
  const store = new SessionStore()
  const ids: string[] = []
  for (let i = 0; i < 12; i++) ids.push(await store.create(credentials))
  const other = await store.create({ ...credentials, u: 'another' })

  assert.equal(store.get(ids[0]), undefined)
  assert.equal(store.get(ids[1]), undefined)
  assert.deepEqual(store.get(ids[2]), credentials)
  assert.deepEqual(store.get(ids[11]), credentials)
  assert.ok(store.get(other))
})

test('the file of the sessions is only for its owner', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'shelv-sessions-'))
  const file = join(folder, 'sessions.json')

  await new SessionStore(file).create(credentials)

  assert.equal((await stat(file)).mode & 0o777, 0o600)
})

test('the name of the cookie is bound to the host over https', () => {
  assert.equal(sessionCookieName(true), '__Host-shelv_session')
  assert.equal(sessionCookieName(false), 'shelv_session')
})

test('the login limiter blocks after too many attempts', () => {
  const limiter = new LoginLimiter()

  for (let i = 0; i < 10; i++)
    assert.equal(limiter.start('1.2.3.4', `u${i}`), true)
  assert.equal(limiter.start('1.2.3.4', 'u11'), false)
  assert.equal(limiter.start('5.6.7.8', 'u11'), true)
})

test('the limiter counts a burst of attempts that start at once', () => {
  const limiter = new LoginLimiter()
  const started = Array.from({ length: 30 }, () =>
    limiter.start('1.2.3.4', 'vasco'),
  )

  assert.equal(started.filter(Boolean).length, 10)
})

test('the limiter stops a user who is tried from many addresses', () => {
  const limiter = new LoginLimiter()

  for (let i = 0; i < 50; i++)
    assert.equal(limiter.start(`10.0.0.${i}`, 'Vasco'), true)
  assert.equal(limiter.start('10.9.9.9', 'vasco'), false)
  assert.equal(limiter.start('10.9.9.9', 'someone else'), true)
})

test('a login that worked gives its attempt back, nothing else', () => {
  const limiter = new LoginLimiter()

  for (let i = 0; i < 9; i++) limiter.start('1.2.3.4', 'other')
  assert.equal(limiter.start('1.2.3.4', 'vasco'), true)
  limiter.succeed('1.2.3.4', 'vasco')

  // the nine failures still count
  assert.equal(limiter.start('1.2.3.4', 'x'), true)
  assert.equal(limiter.start('1.2.3.4', 'y'), false)
})

test('the limiter forgets attempts after ten minutes', () => {
  const limiter = new LoginLimiter()
  for (let i = 0; i < 10; i++) limiter.start('1.2.3.4', `u${i}`)
  assert.equal(limiter.start('1.2.3.4', 'x'), false)

  const originalNow = Date.now
  Date.now = () => originalNow() + 11 * 60 * 1000
  try {
    assert.equal(limiter.start('1.2.3.4', 'x'), true)
  } finally {
    Date.now = originalNow
  }
})

test('made up addresses can not fill the memory', () => {
  const limiter = new LoginLimiter()
  const before = process.memoryUsage().heapUsed

  for (let i = 0; i < 50_000; i++) limiter.start(`fake-${i}`, `user-${i}`)

  assert.ok(process.memoryUsage().heapUsed - before < 50 * 1024 * 1024)
  // the newest ones are still counted
  for (let i = 0; i < 9; i++) limiter.start('fake-49999', `user-${i}`)
  assert.equal(limiter.start('fake-49999', 'x'), false)
})
