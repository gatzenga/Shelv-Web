import { getBackendUrl, httpClient } from '@/api/httpClient'
import {
  CreateRadio,
  Radio,
  RadioNowPlaying,
  RadioStationsResponse,
  RadioStreamKind,
} from '@/types/responses/radios'
import { SubsonicResponse } from '@/types/responses/subsonicResponse'

async function getAll() {
  const response = await httpClient<RadioStationsResponse>(
    '/getInternetRadioStations',
    {
      method: 'GET',
    },
  )

  return response?.data.internetRadioStations.internetRadioStation || []
}

async function create({ name, streamUrl, homePageUrl = '' }: CreateRadio) {
  await httpClient<SubsonicResponse>('/createInternetRadioStation', {
    method: 'POST',
    query: {
      streamUrl,
      name,
      homepageUrl: homePageUrl,
    },
  })
}

async function update({ id, streamUrl, name, homePageUrl = '' }: Radio) {
  await httpClient<SubsonicResponse>('/updateInternetRadioStation', {
    method: 'GET',
    query: {
      id,
      streamUrl,
      name,
      homepageUrl: homePageUrl,
    },
  })
}

async function remove(id: string) {
  await httpClient<SubsonicResponse>('/deleteInternetRadioStation', {
    method: 'GET',
    query: {
      id,
    },
  })
}

function getStreamUrl(id: string) {
  return getBackendUrl('/api/radio/stream', { id })
}

async function getStreamKind(id: string): Promise<RadioStreamKind> {
  const response = await fetch(getBackendUrl('/api/radio/probe', { id }))
  if (!response.ok) return 'direct'

  const { kind } = (await response.json()) as { kind: RadioStreamKind }
  return kind
}

async function getNowPlaying(id: string, signal: AbortSignal) {
  const response = await fetch(getBackendUrl('/api/radio/nowplaying', { id }), {
    signal,
    cache: 'no-store',
  })
  if (!response.ok) return null

  return (await response.json()) as RadioNowPlaying
}

export const radios = {
  getAll,
  create,
  update,
  remove,
  getStreamUrl,
  getStreamKind,
  getNowPlaying,
}
