import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { privateCacheControl } from './http.ts'

test('what an upstream server allows everyone to keep is only for the user', () => {
  assert.equal(
    privateCacheControl('public, max-age=315360000'),
    'private, max-age=315360000',
  )
  assert.equal(privateCacheControl('Public'), 'private')
  assert.equal(privateCacheControl('no-cache'), 'no-cache')
  assert.equal(
    privateCacheControl('private, max-age=60'),
    'private, max-age=60',
  )
})
