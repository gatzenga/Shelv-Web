import { SubsonicResponse } from './subsonicResponse'

export interface CreateRadio {
  name: string
  streamUrl: string
  homePageUrl?: string
}

export interface Radio extends CreateRadio {
  id: string
  // image uploaded to the station in Navidrome (ra-<id>)
  coverArt?: string
}
export interface RadioStation {
  internetRadioStation: Radio[]
}

export interface RadioStationsResponse
  extends SubsonicResponse<{ internetRadioStations: RadioStation }> {}

// GET /api/radio/nowplaying, see server/radio-source.ts
export interface RadioNowPlaying {
  available: boolean
  source: 'azuracast' | 'icy'
  pollInterval: number
  stationName: string | null
  title: string | null
  artist: string | null
  album: string | null
  artworkUrl: string | null
  isLive: boolean
  isOnline: boolean
}

export type RadioStreamKind = 'hls' | 'direct'
