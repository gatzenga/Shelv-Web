import { strict as assert } from 'node:assert'
import { before, describe, test } from 'node:test'
import { DOMParser } from 'linkedom'
import { isMusicBrainzId, safeUrl } from './safeUrl.ts'

let sanitizeLinks: (text: string) => string

// The sanitizer is made for the DOM of a browser. This one is for tests and wants
// a whole page, a browser puts the missing <html><body> around a piece by itself.
class TestDOMParser {
  parseFromString(text: string) {
    return new DOMParser().parseFromString(
      `<!doctype html><html><body>${text}</body></html>`,
      'text/html',
    )
  }
}

before(async () => {
  Object.assign(globalThis, { DOMParser: TestDOMParser })
  ;({ sanitizeLinks } = await import('./parseTexts.ts'))
})

describe('the text of a biography', () => {
  test('keeps the text and the tags of a text', () => {
    const text =
      '<p>He is <strong>very</strong> <em>good</em></p><ul><li>one</li></ul><h3>Title</h3>'

    assert.equal(sanitizeLinks(text), text)
  })

  test('keeps a link to a web page and makes it safe', () => {
    const html = sanitizeLinks(
      '<a href="https://www.last.fm/music/Artist" onclick="x()" class="a">more</a>',
    )

    assert.match(html, /^<a [^>]*>more<\/a>$/)
    assert.match(html, / href="https:\/\/www\.last\.fm\/music\/Artist"/)
    assert.match(html, / target="_blank"/)
    assert.match(html, / rel="noreferrer nofollow"/)
    assert.doesNotMatch(html, /onclick|class/)
    assert.match(
      sanitizeLinks('<a href="mailto:a@b.c">mail</a>'),
      /href="mailto:a@b\.c"/,
    )
  })

  test('turns a link that leads anywhere else into its text', () => {
    const links = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      '&#106;avascript:alert(1)',
      ' javascript:alert(1)',
      'vbscript:x',
      'data:text/html,<script>alert(1)</script>',
      // a way to the app itself or to a host written like a path
      '/rest/deletePlaylist?id=1',
      '//evil.example/login',
      '/\\evil.example',
      '#top',
      '../up',
      '',
    ]

    for (const href of links) {
      const html = sanitizeLinks(`<p><a href="${href}">text</a></p>`)

      assert.equal(html, '<p>text</p>', href)
    }
  })

  test('has no picture, and a picture is not made of anything else either', () => {
    const attempts = [
      '<img src="/rest/createInternetRadioStation?streamUrl=https://evil/x">',
      '<img src="https://evil.example/pixel.gif">',
      '<img src=x onerror="alert(1)">',
      '<svg onload="alert(1)"></svg>',
      '<video src="x"></video>',
      '<audio src="x"></audio>',
      '<iframe src="https://evil.example"></iframe>',
      '<object data="x"></object>',
      '<embed src="x">',
      '<link rel="stylesheet" href="https://evil.example/x.css">',
      '<style>body { background: url(https://evil.example/x) }</style>',
      '<form action="https://evil.example"><input name="password"></form>',
      '<math><mglyph><style><img src=x onerror=alert(1)>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<template><img src=x></template>',
      '<script>alert(1)</script>',
    ]

    for (const attempt of attempts) {
      const html = sanitizeLinks(`<p>before</p>${attempt}<p>after</p>`)

      assert.doesNotMatch(
        html,
        /<(img|svg|video|audio|iframe|object|embed|link|style|form|input|math|template|script|noscript)/i,
        attempt,
      )
      assert.doesNotMatch(html, /onerror|onload|evil/i, attempt)
      assert.match(html, /^<p>before<\/p>/, attempt)
    }
  })

  test('drops every attribute but the address of a link', () => {
    const html = sanitizeLinks(
      '<div class="fixed inset-0 z-50 bg-background" style="position:fixed" id="x" onclick="a()">Your session expired</div>',
    )

    assert.equal(html, '<div>Your session expired</div>')
  })

  test('shows what is in a tag it does not know only when it is a <tt>', () => {
    assert.equal(sanitizeLinks('<tt>code</tt> text'), 'code text')
    assert.equal(sanitizeLinks('a<font>gone</font>b'), 'ab')
  })

  test('does not change when it is read again', () => {
    const once = sanitizeLinks(
      '<p>a <a href="https://x.example/?a=1&b=2">b</a> <b>c</b></p><img src=x>',
    )

    assert.equal(sanitizeLinks(once), once)
  })
})

describe('addresses from outside', () => {
  test('only web pages are addresses', () => {
    assert.equal(
      safeUrl('https://www.last.fm/music/Artist'),
      'https://www.last.fm/music/Artist',
    )
    assert.equal(safeUrl(' http://example.com '), 'http://example.com/')
    assert.equal(safeUrl('javascript:alert(1)'), null)
    assert.equal(safeUrl('//example.com'), null)
    assert.equal(safeUrl('/relative'), null)
    assert.equal(safeUrl(''), null)
    assert.equal(safeUrl('mailto:a@b.c'), null)
    assert.equal(safeUrl('mailto:a@b.c', ['mailto:']), 'mailto:a@b.c')
  })

  test('a MusicBrainz id is an id and nothing else', () => {
    assert.equal(isMusicBrainzId('5b11f4ce-a62d-471e-81fc-a69a8278c7da'), true)
    assert.equal(isMusicBrainzId('../../other'), false)
    assert.equal(
      isMusicBrainzId('5b11f4ce-a62d-471e-81fc-a69a8278c7da/x'),
      false,
    )
    assert.equal(isMusicBrainzId(''), false)
  })
})
