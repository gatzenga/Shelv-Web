import type { LastFMTrack } from './lastfm-types.ts'

export interface LibrarySong {
  id: string
  title: string
  artist?: string
  displayArtist?: string
  displayAlbumArtist?: string
  album?: string
  playCount?: number
  artists?: { name?: string }[]
  albumArtists?: { name?: string }[]
  [key: string]: unknown
}

export function normalize(value: string): string {
  let str = value.replace(/&/g, ' and ')
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  str = str.toLowerCase().replace(/[^a-z0-9]/g, ' ')
  return str.trim().split(/\s+/).filter(Boolean).join(' ')
}

export function strippedTitle(title: string): string {
  let result = title.replace(/\s*[([{][^)\]}]*[)\]}]/g, '')
  result = result.replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/i, '')
  const dashIndex = result.lastIndexOf(' - ')
  if (dashIndex !== -1) {
    const suffix = result.slice(dashIndex + 3).toLowerCase()
    const versionWords = [
      'remaster',
      'version',
      'edit',
      'mix',
      'live',
      'mono',
      'stereo',
      'demo',
      'acoustic',
      'single',
      'radio',
      'deluxe',
      'bonus',
      'instrumental',
      'feat',
    ]
    if (versionWords.some((word) => suffix.includes(word))) {
      result = result.slice(0, dashIndex)
    }
  }
  const trimmed = result.trim()
  return trimmed.length === 0 ? title : trimmed
}

export function artistNames(artist: string): string[] {
  return artist
    .replace(
      /\s*(,|;|&|\/|•|·|×|\bfeat\.?|\bft\.?|\bfeaturing\b|\bvs\.?|\bx\b)\s*/gi,
      '\u001f',
    )
    .split('\u001f')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function songArtistNames(song: LibrarySong): Set<string> {
  const names: string[] = []
  if (song.artist) names.push(song.artist)
  if (song.displayArtist) names.push(song.displayArtist)
  if (song.displayAlbumArtist) names.push(song.displayAlbumArtist)
  if (song.artists) {
    for (const a of song.artists) {
      if (a.name) names.push(a.name)
    }
  }
  if (song.albumArtists) {
    for (const a of song.albumArtists) {
      if (a.name) names.push(a.name)
    }
  }
  const result = new Set<string>()
  for (const name of names) {
    const norm = normalize(name)
    if (norm) result.add(norm)
    for (const part of artistNames(name)) {
      const normPart = normalize(part)
      if (normPart) result.add(normPart)
    }
  }
  return result
}

export function searchQueries(track: LastFMTrack): string[] {
  const title = strippedTitle(track.title)
  const artist = artistNames(track.artist)[0] ?? track.artist
  const queries = [`${artist} ${title}`, title]
  if (title !== track.title) {
    queries.push(track.title)
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const q of queries) {
    const trimmed = q.trim()
    const lower = trimmed.toLowerCase()
    if (trimmed.length > 0 && !seen.has(lower)) {
      seen.add(lower)
      result.push(trimmed)
    }
  }
  return result
}

export function bestMatch<T extends LibrarySong>(
  track: LastFMTrack,
  candidates: T[],
): T | null {
  const exactTitle = normalize(track.title)
  const looseTitle = normalize(strippedTitle(track.title))
  const wantedArtists = new Set<string>(
    artistNames(track.artist).map(normalize).filter(Boolean),
  )
  const normArtist = normalize(track.artist)
  if (normArtist) wantedArtists.add(normArtist)

  const wantedAlbum = track.album ? normalize(track.album) : undefined

  let best: { song: T; score: number } | null = null

  for (const song of candidates) {
    const title = normalize(song.title)
    let titleScore: number
    if (title === exactTitle) {
      titleScore = 2
    } else if (
      looseTitle.length > 0 &&
      normalize(strippedTitle(song.title)) === looseTitle
    ) {
      titleScore = 1
    } else {
      continue
    }

    const songArtists = songArtistNames(song)
    let hasArtistOverlap = false
    for (const a of wantedArtists) {
      if (songArtists.has(a)) {
        hasArtistOverlap = true
        break
      }
    }
    if (!hasArtistOverlap) continue

    let score = titleScore * 100
    if (wantedAlbum && song.album && normalize(song.album) === wantedAlbum) {
      score += 50
    }
    score += Math.min(song.playCount ?? 0, 49)

    if (!best || score > best.score) {
      best = { song, score }
    }
  }

  return best ? best.song : null
}

export function trackKey(track: LastFMTrack): string {
  return `${normalize(track.artist)}\u001f${normalize(track.title)}`
}
