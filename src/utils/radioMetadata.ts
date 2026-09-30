// Now playing logic of the Shelv player (RadioNowPlayingMetadata in
// RadioStation.swift): which values are shown and when old values are kept.
import { RadioNowPlaying } from '@/types/responses/radios'

const titlePlaceholders = new Set([
  'unknown',
  'unknown title',
  'titel unbekannt',
  '<unknown>',
  'n/a',
  'na',
])

const artistPlaceholders = new Set([
  'unknown',
  'unknown artist',
  'kunstler unbekannt',
  '<unknown>',
  'n/a',
  'na',
])

function sanitized(value: string | null, placeholders: Set<string>) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  // case and diacritic insensitive, "Künstler" matches "kunstler"
  const normalized = trimmed
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

  return placeholders.has(normalized) ? null : trimmed
}

export function displayTitle(metadata: RadioNowPlaying | null) {
  return sanitized(metadata?.title ?? null, titlePlaceholders)
}

export function displayArtist(metadata: RadioNowPlaying | null) {
  return sanitized(metadata?.artist ?? null, artistPlaceholders)
}

// A response without title and artist (e.g. between two songs or during a
// jingle) does not wipe what is shown, only station name and live state change
export function resolveNowPlaying(
  current: RadioNowPlaying | null,
  incoming: RadioNowPlaying,
): RadioNowPlaying {
  const incomingIsEmpty =
    displayTitle(incoming) === null && displayArtist(incoming) === null
  const currentHasTrack =
    current !== null &&
    (displayTitle(current) !== null || displayArtist(current) !== null)

  if (!incomingIsEmpty || !current || !currentHasTrack) return incoming

  return {
    ...current,
    stationName: incoming.stationName,
    isLive: incoming.isLive,
    isOnline: incoming.isOnline,
    artworkUrl: current.artworkUrl ?? incoming.artworkUrl,
  }
}
