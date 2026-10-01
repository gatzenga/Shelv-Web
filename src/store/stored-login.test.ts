import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { withoutStoredLogin } from './stored-login.ts'

test('the login an old build kept in the browser is removed', () => {
  const stored = {
    data: {
      url: 'https://music.example.com',
      username: 'vasco',
      password: 'c3e8a2f1d7b54e0a9b6c1d2e3f4a5b6c',
      authType: 1,
      isServerConfigured: true,
    },
    pages: { artistsPageViewType: 'table' },
  }

  const kept = withoutStoredLogin(stored)

  assert.deepEqual(kept, {
    data: {
      url: 'https://music.example.com',
      username: 'vasco',
      isServerConfigured: true,
    },
    pages: { artistsPageViewType: 'table' },
  })
  // the state of the app is not changed, a copy is
  assert.equal(stored.data.password, 'c3e8a2f1d7b54e0a9b6c1d2e3f4a5b6c')
})

test('a store without a login stays as it is', () => {
  const stored = { data: { username: 'vasco' }, pages: {} }

  assert.deepEqual(withoutStoredLogin(stored), stored)
  assert.deepEqual(withoutStoredLogin({}), {})
})
