import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { withoutLogin } from './server-info.ts'

test('a name and a password are taken out of an address', () => {
  assert.equal(
    withoutLogin('http://admin:secret@navidrome:4533'),
    'http://navidrome:4533',
  )
  assert.equal(
    withoutLogin('https://user:p%40ss@music.example.com/navidrome/'),
    'https://music.example.com/navidrome',
  )
  assert.equal(withoutLogin('http://navidrome:4533'), 'http://navidrome:4533')
  assert.equal(withoutLogin('not an address'), 'invalid address')
})
