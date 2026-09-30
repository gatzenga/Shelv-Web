const selector = '#main-scroll-area #scroll-viewport'

// A page with a fixed header and toolbar scrolls its own list, marked with
// data-page-scroll, so the scrollbar starts below the toolbar
const pageSelector = '[data-page-scroll] [data-radix-scroll-area-viewport]'

export function getMainScrollElement() {
  return (document.querySelector(pageSelector) ??
    document.querySelector(selector)) as HTMLDivElement
}

export function getMainScrollContentElement() {
  return document.querySelector(`${selector} > div`) as HTMLDivElement
}

export function scrollPageToTop() {
  const el = document.querySelector(selector)

  if (el) {
    el.scrollTo({ top: 0 })
  }
}
