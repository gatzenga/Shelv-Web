import { Radio } from './responses/radios'
import { ISong } from './responses/song'

export enum LoopState {
  Off = 0,
  All = 1,
  One = 2,
}

export interface ISongList {
  shuffledList: ISong[]
  currentList: ISong[]
  currentSongIndex: number
  currentSong: ISong
  originalList: ISong[]
  originalSongIndex: number
  radioList: Radio[]
  playNextQueue: ISong[]
  userQueue: ISong[]
}

export type PlaybackSourceType =
  | 'playlist'
  | 'album'
  | 'artist'
  | 'favourite'
  | 'songs'

export type PlaybackSource = {
  type: PlaybackSourceType
  id: string
  name: string
}

export interface IPlaybackContext {
  source: PlaybackSource | null
  isSourceModified: boolean
}

export interface IPlayerState {
  isPlaying: boolean
  loopState: LoopState
  isShuffleActive: boolean
  isSongStarred: boolean
  volume: number
  currentDuration: number
  mediaType: 'song' | 'radio'
  audioPlayerRef: HTMLAudioElement | null
  mainDrawerState: boolean
  queueState: boolean
  lyricsState: boolean
  hasSyncedTheCurrentTrack: boolean
  hasScrobbledTheCurrentTrack: boolean
  hasPrev: boolean
  hasNext: boolean
  infinityModeEnabled: boolean
  playbackContext: IPlaybackContext
}

export interface IPlayerProgress {
  progress: number
}

export interface IListenTime {
  accumulated: number
}

export interface IVolumeSettings {
  min: number
  max: number
  step: number
  wheelStep: number
}

interface IColorsSettings {
  currentSongColor: string | null
}

export interface IPlayerSettings {
  volume: IVolumeSettings
  colors: IColorsSettings
}

export interface IPlayerActions {
  playSong: (song: ISong) => void
  setSongList: (
    songlist: ISong[],
    index: number,
    shuffle?: boolean,
    playbackSource?: PlaybackSource | null,
  ) => void
  setCurrentSong: () => void
  checkIsSongStarred: () => void
  starSongInQueue: (id: string) => void
  starCurrentSong: () => Promise<void>
  setPlayingState: (status: boolean) => void
  togglePlayPause: () => void
  toggleLoop: () => void
  toggleShuffle: () => void
  checkActiveSong: (id: string) => boolean
  playNextSong: () => void
  playPrevSong: () => void
  hasNextSong: () => boolean
  hasPrevSong: () => boolean
  isPlayingOneSong: () => boolean
  clearPlayerState: () => void
  resetProgress: () => void
  setProgress: (progress: number) => void
  setVolume: (volume: number) => void
  handleVolumeWheel: (isScrollingDown: boolean) => void
  setCurrentDuration: (duration: number) => void
  setPlayRadio: (list: Radio[], index: number) => void
  setAudioPlayerRef: (ref: HTMLAudioElement) => void
  setNextOnQueue: (songlist: ISong[]) => void
  setLastOnQueue: (songlist: ISong[]) => void
  jumpToPlayNext: (index: number) => void
  jumpToQueueTrack: (queueIndex: number) => void
  jumpToUserQueue: (index: number) => void
  removeFromPlayNextQueue: (index: number) => void
  removeFromPlayQueue: (queueIndex: number) => void
  removeFromUserQueue: (index: number) => void
  moveInPlayNextQueue: (from: number, to: number) => void
  moveInUpcomingQueue: (from: number, to: number) => void
  moveInUserQueue: (from: number, to: number) => void
  toggleInfinityMode: () => void
  setInfinityMode: (enabled: boolean) => void
  topUpInfinityIfNeeded: (startIfIdle?: boolean) => Promise<void>
  removeSongFromQueue: (id: string) => void
  clearQueue: () => void
  moveSongInQueue: (from: number, to: number) => void
  setMainDrawerState: (state: boolean) => void
  setQueueState: (state: boolean) => void
  toggleQueueAction: () => void
  setLyricsState: (state: boolean) => void
  toggleLyricsAction: () => void
  toggleQueueAndLyrics: () => void
  closeDrawer: () => void
  setHasSyncedTheCurrentTrack: (value: boolean) => void
  setHasScrobbledTheCurrentTrack: (value: boolean) => void
  incrementAccumulatedTime: (delta: number) => void
  resetAccumulatedTime: () => void
  playFirstSongInQueue: () => void
  handleSongEnded: () => void
  getCurrentProgress: () => number
  updateQueueChecks: () => void
  setCurrentSongColor: (value: string | null) => void
}

export interface IPlayerContext {
  songlist: ISongList
  playerState: IPlayerState
  playerProgress: IPlayerProgress
  listenTime: IListenTime
  settings: IPlayerSettings
  actions: IPlayerActions
}
