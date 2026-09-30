import { RadioIcon } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { getSongStreamUrl } from '@/api/httpClient'
import { RadioInfo } from '@/app/components/player/radio-info'
import { TrackInfo } from '@/app/components/player/track-info'
import { useRadioNowPlaying } from '@/app/hooks/use-radio-now-playing'
import {
  getVolume,
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerMediaType,
  usePlayerRef,
  usePlayerSonglist,
} from '@/store/player.store'
import { LoopState } from '@/types/playerContext'
import { ensureSupportForAlac } from '@/utils/alac'
import { AudioPlayer } from './audio'
import { PlayerAudioBadge } from './audio-badge'
import { PlayerControls } from './controls'
import { PlayerLyricsButton } from './lyrics-button'
import { PlayerProgress } from './progress'
import { PlayerQueueButton } from './queue-button'
import { RadioAudio } from './radio-audio'
import { PlayerVolume } from './volume'

const MemoTrackInfo = memo(TrackInfo)
const MemoRadioInfo = memo(RadioInfo)
const MemoPlayerControls = memo(PlayerControls)
const MemoPlayerProgress = memo(PlayerProgress)
const MemoPlayerQueueButton = memo(PlayerQueueButton)
const MemoPlayerVolume = memo(PlayerVolume)
const MemoLyricsButton = memo(PlayerLyricsButton)

export function Player() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const radioRef = useRef<HTMLAudioElement>(null)
  const {
    setAudioPlayerRef,
    setCurrentDuration,
    setProgress,
    setPlayingState,
    handleSongEnded,
    getCurrentProgress,
  } = usePlayerActions()
  const { currentList, currentSongIndex, radioList, currentSong } =
    usePlayerSonglist()
  const isPlaying = usePlayerIsPlaying()
  const { isSong, isRadio } = usePlayerMediaType()
  const loopState = usePlayerLoop()
  const audioPlayerRef = usePlayerRef()

  const song = currentSong?.id ? currentSong : currentList[currentSongIndex]
  const radio = radioList[currentSongIndex]

  useRadioNowPlaying(isRadio ? radio : undefined)

  const songId = song?.id

  const songStreamUrl = useMemo(() => {
    if (!songId) return ''

    return getSongStreamUrl(
      songId,
      undefined,
      ensureSupportForAlac(song.suffix),
    )
  }, [songId, song])

  const getAudioRef = useCallback(() => {
    if (isRadio) return radioRef

    return audioRef
  }, [isRadio])

  // biome-ignore lint/correctness/useExhaustiveDependencies: audioRef needed
  useEffect(() => {
    if (!isSong && !song) return

    if (audioPlayerRef === null && audioRef.current)
      setAudioPlayerRef(audioRef.current)
  }, [audioPlayerRef, audioRef, isSong, setAudioPlayerRef, song])

  const setupDuration = useCallback(() => {
    const audio = getAudioRef().current
    if (!audio) return

    const audioDuration = Math.floor(audio.duration)
    const infinityDuration = audioDuration === Infinity

    if (!infinityDuration) {
      setCurrentDuration(audioDuration)
    } else if (isSong && song?.duration) {
      setCurrentDuration(song.duration)
    }

    audio.currentTime = getCurrentProgress()
  }, [getAudioRef, isSong, song, setCurrentDuration, getCurrentProgress])

  const setupProgress = useCallback(() => {
    const audio = getAudioRef().current
    if (!audio) return

    const currentProgress = Math.floor(audio.currentTime)
    setProgress(currentProgress)
  }, [getAudioRef, setProgress])

  const setupInitialVolume = useCallback(() => {
    const audio = getAudioRef().current
    if (!audio) return

    audio.volume = getVolume() / 100
  }, [getAudioRef])

  return (
    <footer className="border-t h-[--player-height] w-full flex items-center fixed bottom-0 left-0 right-0 z-40 bg-background">
      <div className="w-full h-full grid grid-cols-player gap-2 px-4">
        {/* Track Info */}
        <div className="flex items-center gap-2 w-full">
          {isSong && <MemoTrackInfo song={song} />}
          {isRadio && <MemoRadioInfo radio={radio} />}
        </div>
        {/* Main Controls */}
        <div className="col-span-2 flex flex-col justify-center items-center px-4 gap-1">
          <MemoPlayerControls song={song} radio={radio} />

          {isSong && <MemoPlayerProgress audioRef={getAudioRef()} />}
        </div>
        {/* Remain Controls and Volume */}
        <div className="flex items-center w-full justify-end">
          <div className="flex items-center gap-1">
            {isSong && (
              <>
                <PlayerAudioBadge song={song} />
                <MemoPlayerQueueButton disabled={!song} />
                <MemoLyricsButton disabled={!song} />
              </>
            )}

            {isRadio && radio && (
              <div
                className="flex items-center gap-1.5 mr-2 text-xs text-muted-foreground"
                data-testid="player-radio-station"
              >
                <span className="truncate max-w-[160px] 2xl:max-w-[220px]">
                  {radio.name}
                </span>
                <RadioIcon className="w-4 h-4 shrink-0" />
              </div>
            )}

            <MemoPlayerVolume
              audioRef={getAudioRef()}
              disabled={!song && !radio}
            />
          </div>
        </div>
      </div>

      {isSong && song && (
        <AudioPlayer
          src={songStreamUrl}
          autoPlay={isPlaying}
          audioRef={audioRef}
          loop={loopState === LoopState.One}
          onPlay={() => setPlayingState(true)}
          onPause={() => setPlayingState(false)}
          onLoadedMetadata={setupDuration}
          onTimeUpdate={setupProgress}
          onEnded={handleSongEnded}
          onLoadStart={setupInitialVolume}
          data-testid="player-song-audio"
        />
      )}

      {isRadio && radio && (
        <RadioAudio
          radio={radio}
          audioRef={radioRef}
          onLoadStart={setupInitialVolume}
          data-testid="player-radio-audio"
        />
      )}
    </footer>
  )
}
