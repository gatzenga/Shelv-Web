import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { clientAddress, isHttps, mayUseSession } from './request.ts'

function request(headers: Record<string, string>, socket: object = {}) {
  return {
    headers,
    socket: { remoteAddress: '172.18.0.5', ...socket },
  } as never
}

test('the visitor is the one Cloudflare names', () => {
  const req = request({
    'cf-connecting-ip': '203.0.113.7',
    'x-forwarded-for': '1.1.1.1, 203.0.113.7, 104.16.0.1',
  })

  assert.equal(clientAddress(req), '203.0.113.7')
})

test('without Cloudflare the last entry of X-Forwarded-For counts', () => {
  const req = request({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 203.0.113.9' })

  assert.equal(clientAddress(req), '203.0.113.9')
})

test('without a proxy the address of the connection counts', () => {
  assert.equal(clientAddress(request({})), '172.18.0.5')
})

test('an address is cut short, whatever the visitor sends', () => {
  const req = request({ 'cf-connecting-ip': 'a'.repeat(5000) })

  assert.equal(clientAddress(req).length, 64)
})

test('https is known from the proxy or from the connection', () => {
  assert.equal(isHttps(request({})), false)
  assert.equal(isHttps(request({ 'x-forwarded-proto': 'https' })), true)
  assert.equal(isHttps(request({ 'x-forwarded-proto': 'http' })), false)
  assert.equal(isHttps(request({ 'cf-visitor': '{"scheme":"https"}' })), true)
  assert.equal(isHttps(request({ 'cf-visitor': '{"scheme":"http"}' })), false)
  assert.equal(isHttps(request({}, { encrypted: true })), true)
})

test('the session is for the app itself, not for other sites', () => {
  const use = (headers: Record<string, string>, path = '/api/mix') =>
    mayUseSession(request(headers), path)

  // curl and other tools send no such headers
  assert.equal(use({}), true)
  assert.equal(use({ 'sec-fetch-site': 'same-origin' }), true)
  assert.equal(use({ 'sec-fetch-site': 'none' }), true)
  assert.equal(use({ 'sec-fetch-site': 'same-site' }), false)
  assert.equal(use({ 'sec-fetch-site': 'cross-site' }), false)
})

test('only media may be loaded by an element instead of fetch()', () => {
  const load = (path: string, destination: string) =>
    mayUseSession(
      request({
        'sec-fetch-site': 'same-origin',
        'sec-fetch-dest': destination,
      }),
      path,
    )

  assert.equal(load('/rest/getCoverArt', 'image'), true)
  assert.equal(load('/rest/getCoverArt.view', 'image'), true)
  assert.equal(load('/rest/stream', 'audio'), true)
  assert.equal(load('/rest/download', 'document'), true)
  assert.equal(load('/api/radio/stream', 'audio'), true)
  assert.equal(load('/rest/deletePlaylist', 'image'), false)
  assert.equal(load('/rest/createInternetRadioStation', 'image'), false)
  assert.equal(load('/api/lyrics/reset', 'document'), false)
  assert.equal(load('/rest/deletePlaylist', 'empty'), true)
})
