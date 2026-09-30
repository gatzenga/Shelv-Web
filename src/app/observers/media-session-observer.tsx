import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSimpleCoverArtUrl } from '@/api/httpClient'
import {
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerSonglist,
} from '@/store/player.store'
import { useRadioPlaybackStore } from '@/store/radio-playback.store'
import { appName } from '@/utils/appName'
import { displayArtist, displayTitle } from '@/utils/radioMetadata'
import { manageMediaSession } from '@/utils/setMediaSession'

export function MediaSessionObserver() {
  const { t } = useTranslation()
  const isPlaying = usePlayerIsPlaying()
  const { isRadio, isSong } = usePlayerMediaType()
  const { currentList, radioList, currentSongIndex } = usePlayerSonglist()
  const radioLabel = t('radios.label')

  const song = currentList[currentSongIndex] ?? null
  const radio = radioList[currentSongIndex] ?? null
  const radioNowPlaying = useRadioPlaybackStore((state) => state.nowPlaying)

  const hasNothingPlaying = currentList.length === 0 && radioList.length === 0

  const resetAppTitle = useCallback(() => {
    document.title = appName
  }, [])

  useEffect(() => {
    manageMediaSession.setPlaybackState(isPlaying)

    if (hasNothingPlaying) {
      manageMediaSession.removeMediaSession()
    }

    if (hasNothingPlaying || !isPlaying) {
      resetAppTitle()
      return
    }

    let title = ''

    if (isRadio && radio) {
      const radioTitle = displayTitle(radioNowPlaying) ?? radio.name
      const radioArtist = displayArtist(radioNowPlaying)
      const stationCover = radio.coverArt
        ? getSimpleCoverArtUrl(radio.coverArt, 'album', '512')
        : null

      title = radioArtist ? `${radioArtist} - ${radioTitle}` : radioTitle
      manageMediaSession.setRadioMediaSession({
        title: radioTitle,
        artist: radioArtist ?? radioLabel,
        stationName: radio.name,
        artworkUrl: radioNowPlaying?.artworkUrl ?? stationCover,
      })
    }
    if (isSong && song) {
      title = `${song.artist} - ${song.title}`
      manageMediaSession.setMediaSession(song)
    }

    document.title = title
  }, [
    hasNothingPlaying,
    isPlaying,
    isRadio,
    isSong,
    radio,
    radioLabel,
    radioNowPlaying,
    song,
    resetAppTitle,
  ])

  return null
}
