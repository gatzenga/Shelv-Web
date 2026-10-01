import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { inlineConfig, pageSecurityPolicy } from './static.ts'

const html = '<head><script src="./env-config.js"></script></head>'

test('the config is written into the page', () => {
  const page = inlineConfig(html, 'window.APP_CONFIG = {"a":1};')

  assert.equal(
    page,
    '<head><script>window.APP_CONFIG = {"a":1};</script></head>',
  )
})

test('what looks like a pattern or a tag in the config stays as it is', () => {
  const page = inlineConfig(html, 'x = "$& $` $\' </script><b>"')

  assert.ok(page.includes("$& $` $' \\u003c/script>\\u003cb>"))
  assert.equal(page.match(/<script>/g)?.length, 1)
  assert.equal(page.match(/<\/script>/g)?.length, 1)
})

test('the policy of the page names the script of the config and no other', () => {
  const config = 'window.APP_CONFIG = {"a":"<b>"};'
  const policy = pageSecurityPolicy(config)

  // the hash is the one of the script as it is written into the page
  const written = inlineConfig(html, config).match(
    /<script>([\s\S]*)<\/script>/,
  )
  assert.ok(written)
  const hash = createHash('sha256').update(written[1]).digest('base64')

  assert.ok(policy.includes(`script-src 'self' 'sha256-${hash}'`), policy)
  assert.doesNotMatch(policy, /unsafe-eval|script-src[^;]*unsafe-inline/)
  assert.ok(policy.includes("default-src 'none'"))
  assert.ok(policy.includes("object-src 'none'"))
  assert.ok(policy.includes("frame-ancestors 'self'"))
  assert.ok(policy.includes("connect-src 'self'"))
})
