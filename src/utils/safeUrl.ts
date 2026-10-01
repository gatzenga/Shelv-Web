// An address that comes from outside may only lead to a web page or a mail
// address. Relative addresses fail on purpose: "//evil.example" or
// "/rest/deletePlaylist?id=1" would otherwise point to this very app.
export function safeUrl(value: string, protocols = ['http:', 'https:']) {
  try {
    const url = new URL(value.trim())

    return protocols.includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

const musicBrainzId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isMusicBrainzId(value: string) {
  return musicBrainzId.test(value)
}
