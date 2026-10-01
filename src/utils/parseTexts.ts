import { safeUrl } from './safeUrl.ts'

// The text of a biography comes from outside (Last.fm and the like) and is
// shown as HTML. Only these tags stay, and none of them keeps an attribute
// but the address of a link. No picture stays either: a picture is a request
// that the browser makes by itself, with the login of the user.
const allowedTags = new Set([
  'a',
  'b',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'u',
  'ul',
])

export function sanitizeLinks(text: string) {
  const doc = new DOMParser().parseFromString(text, 'text/html')

  doc.body.querySelectorAll('*').forEach((node) => {
    const tag = node.tagName.toLowerCase()

    if (!allowedTags.has(tag)) {
      // the text of <tt> stays, anything else goes with what is inside
      if (tag === 'tt') node.replaceWith(...Array.from(node.childNodes))
      else node.remove()
      return
    }

    const href =
      tag === 'a'
        ? safeUrl(node.getAttribute('href') ?? '', [
            'http:',
            'https:',
            'mailto:',
          ])
        : null

    for (const { name } of Array.from(node.attributes)) {
      node.removeAttribute(name)
    }

    if (tag !== 'a') return

    // a link that leads nowhere safe is only its text
    if (!href) {
      node.replaceWith(...Array.from(node.childNodes))
      return
    }

    node.setAttribute('href', href)
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer nofollow')
  })

  return doc.body.innerHTML
}
