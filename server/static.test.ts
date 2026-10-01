import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { inlineConfig } from './static.ts'

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
