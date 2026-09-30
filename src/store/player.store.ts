import { produce } from 'immer'
import clamp from 'lodash/clamp'
import merge from 'lodash/merge'
import omit from 'lodash/omit'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import { getBackendUrl } from '@/api/httpClient'
import { scrobble } from '@/service/scrobble'
import { subsonic } from '@/service/subsonic'
import {
  IPlayerContext,
  ISongList,
  LoopState,
  PlaybackSourceType,
} from '@/types/playerContext'
import { ISong } from '@/types/responses/song'
import { appConfig } from '@/utils/appConfig'
import { shuffleSongList } from '@/utils/songListFunctions'
import { idbStorage } from './idb'

const miniStores = {
  songlist: 'player_songlist',
}

interface PlaybackBackHistoryEntry {
  song: ISong
  queueAnchorIndex: number | null
  queueAnchorSongId: string | null
}

const playbackBackHistory: PlaybackBackHistoryEntry[] = []

const INFINITY_PENDING_KEY = 'infinity_pending_song_ids'

function loadInfinityPendingIds(): string[] {
  try {
    const raw = localStorage.getItem(INFINITY_PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveInfinityPendingIds(ids: string[]) {
  try {
    localStorage.setItem(INFINITY_PENDING_KEY, JSON.stringify(ids))
  } catch {
    // no-op
  }
}

let infinityPendingSongIds: string[] = loadInfinityPendingIds()
let infinityRecentSongIds: string[] = []
let infinityPool: ISong[] = []
let infinityPoolSeedId: string | null = null
let isInfinityTopUpRunning = false
let hasQueuedTopUp = false

function recordTransition(
  fromSong: ISong | null,
  targetSong: ISong,
  queue: ISong[],
  currentIndex: number,
) {
  if (!fromSong || !fromSong.id || fromSong.id === targetSong.id) return

  const hasAnchor = currentIndex >= 0 && currentIndex < queue.length
  playbackBackHistory.push({
    song: fromSong,
    queueAnchorIndex: hasAnchor ? currentIndex : null,
    queueAnchorSongId: hasAnchor ? (queue[currentIndex]?.id ?? null) : null,
  })

  if (playbackBackHistory.length > 500) {
    playbackBackHistory.shift()
  }
}

function popPreviousFromHistory(queue: ISong[]): {
  song: ISong
  queueAnchorIndex: number | null
} | null {
  const entry = playbackBackHistory.pop()
  if (!entry) return null

  let anchorIndex: number | null = null
  if (
    entry.queueAnchorIndex !== null &&
    entry.queueAnchorSongId &&
    entry.queueAnchorIndex >= 0 &&
    entry.queueAnchorIndex < queue.length &&
    queue[entry.queueAnchorIndex]?.id === entry.queueAnchorSongId
  ) {
    anchorIndex = entry.queueAnchorIndex
  } else if (entry.queueAnchorSongId) {
    const idx = queue.findIndex((s) => s.id === entry.queueAnchorSongId)
    if (idx !== -1) anchorIndex = idx
  }

  return { song: entry.song, queueAnchorIndex: anchorIndex }
}

function syncInfinityPendingSongIds(
  playNextQueue: ISong[],
  upcomingAlbum: ISong[],
  userQueue: ISong[],
) {
  const upcomingIds = new Set([
    ...playNextQueue.map((s) => s.id),
    ...upcomingAlbum.map((s) => s.id),
    ...userQueue.map((s) => s.id),
  ])
  infinityPendingSongIds = infinityPendingSongIds.filter((id) =>
    upcomingIds.has(id),
  )
  saveInfinityPendingIds(infinityPendingSongIds)
}

function hasNonInfinityUpcoming(
  playNextQueue: ISong[],
  upcomingAlbum: ISong[],
  userQueue: ISong[],
) {
  const infinitySet = new Set(infinityPendingSongIds)
  const allUpcoming = [...playNextQueue, ...upcomingAlbum, ...userQueue]
  return allUpcoming.some((s) => !infinitySet.has(s.id))
}

function removePendingInfinitySongsFromUserQueue(userQueue: ISong[]): ISong[] {
  const pendingSet = new Set(infinityPendingSongIds)
  infinityPendingSongIds = []
  saveInfinityPendingIds(infinityPendingSongIds)
  return userQueue.filter((s) => !pendingSet.has(s.id))
}

async function fetchInfinityPoolSongs(
  seedSong: ISong | null,
  excludeIds: string[],
): Promise<ISong[]> {
  const shouldMatch = appConfig.infinityMix?.matchCurrentSong ?? true
  try {
    const query: Record<string, string> = {
      exclude: excludeIds.join(','),
      count: '25',
      match: String(shouldMatch),
    }
    if (shouldMatch && seedSong?.id) {
      query.seedId = seedSong.id
    }
    const response = await fetch(getBackendUrl('/api/infinity-mix', query), {
      cache: 'no-store',
    })
    if (response.ok) {
      const data = (await response.json()) as { songs?: ISong[] }
      if (data.songs && data.songs.length > 0) {
        return data.songs
      }
    }
  } catch {
    // fallback below
  }

  try {
    const fallback = await subsonic.songs.getRandomSongs({ size: 25 })
    if (fallback && fallback.length > 0) {
      const excludeSet = new Set(excludeIds)
      const filtered = fallback.filter((s) => !excludeSet.has(s.id))
      return filtered.length > 0 ? filtered : fallback
    }
  } catch {
    // no-op
  }
  return []
}

async function runTopUpInfinityIfNeeded(startIfIdle = false) {
  if (isInfinityTopUpRunning) {
    hasQueuedTopUp = true
    return
  }

  isInfinityTopUpRunning = true
  try {
    let shouldRunAgain = false
    do {
      hasQueuedTopUp = false
      await doTopUpInfinity(startIfIdle)
      shouldRunAgain = hasQueuedTopUp
    } while (shouldRunAgain)
  } finally {
    isInfinityTopUpRunning = false
  }
}

async function doTopUpInfinity(startIfIdle = false) {
  const store = usePlayerStore.getState()
  const { infinityModeEnabled, loopState } = store.playerState
  if (!infinityModeEnabled) return
  if (loopState !== LoopState.Off) return

  const {
    currentList,
    currentSongIndex,
    playNextQueue,
    userQueue,
    currentSong,
  } = store.songlist
  const upcomingAlbum = currentList.slice(currentSongIndex + 1)

  syncInfinityPendingSongIds(playNextQueue, upcomingAlbum, userQueue)

  if (!currentSong?.id && !startIfIdle) return
  if (currentSong?.id) {
    if (hasNonInfinityUpcoming(playNextQueue, upcomingAlbum, userQueue)) return
  }

  const aheadCount = Math.min(
    Math.max(appConfig.infinityMix?.songsToAdd ?? 5, 1),
    10,
  )
  if (infinityPendingSongIds.length >= aheadCount) return

  const shouldMatch = appConfig.infinityMix?.matchCurrentSong ?? true
  const activeSeedId = currentSong?.id ?? null

  if (
    shouldMatch &&
    infinityPool.length > 0 &&
    infinityPoolSeedId &&
    activeSeedId &&
    infinityPoolSeedId !== activeSeedId &&
    !infinityRecentSongIds.includes(activeSeedId)
  ) {
    infinityPool = []
    infinityPoolSeedId = null
  }

  if (!currentSong?.id && startIfIdle) {
    const songs = await fetchInfinityPoolSongs(null, infinityRecentSongIds)
    if (songs.length > 0) {
      const first = songs[0]
      infinityRecentSongIds = [...infinityRecentSongIds, first.id].slice(-200)
      usePlayerStore.getState().actions.setSongList([first], 0, false, null)
    }
  }

  while (
    usePlayerStore.getState().playerState.infinityModeEnabled &&
    usePlayerStore.getState().playerState.loopState === LoopState.Off &&
    infinityPendingSongIds.length < aheadCount
  ) {
    const latestStore = usePlayerStore.getState()
    const {
      currentList: cList,
      currentSongIndex: cIdx,
      playNextQueue: pnQ,
      userQueue: uQ,
      currentSong: cSong,
    } = latestStore.songlist
    const uAlbum = cList.slice(cIdx + 1)
    if (cSong?.id && hasNonInfinityUpcoming(pnQ, uAlbum, uQ)) break

    const queuedIds = new Set([
      ...(cSong?.id ? [cSong.id] : []),
      ...pnQ.map((s) => s.id),
      ...uAlbum.map((s) => s.id),
      ...uQ.map((s) => s.id),
    ])

    let candidate: ISong | null = null
    while (infinityPool.length > 0) {
      const next = infinityPool.shift()!
      if (!queuedIds.has(next.id)) {
        candidate = next
        break
      }
    }

    if (!candidate) {
      const excludeList = Array.from(
        new Set([...queuedIds, ...infinityRecentSongIds]),
      )
      const newSongs = await fetchInfinityPoolSongs(cSong, excludeList)
      if (!newSongs || newSongs.length === 0) break
      infinityPool = newSongs
      infinityPoolSeedId = cSong?.id ?? null
      while (infinityPool.length > 0) {
        const next = infinityPool.shift()!
        if (!queuedIds.has(next.id)) {
          candidate = next
          break
        }
      }
    }

    if (!candidate) break

    infinityPendingSongIds.push(candidate.id)
    saveInfinityPendingIds(infinityPendingSongIds)
    infinityRecentSongIds = [...infinityRecentSongIds, candidate.id].slice(-200)

    usePlayerStore.setState((state) => {
      state.songlist.userQueue.push(candidate!)
    })
  }

  usePlayerStore.getState().actions.updateQueueChecks()
}

export const usePlayerStore = createWithEqualityFn<IPlayerContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set, get) => ({
          songlist: {
            shuffledList: [],
            originalList: [],
            originalSongIndex: 0,
            currentSong: {} as ISong,
            currentList: [],
            currentSongIndex: 0,
            radioList: [],
            playNextQueue: [],
            userQueue: [],
          },
          playerState: {
            isPlaying: false,
            loopState: LoopState.Off,
            isShuffleActive: false,
            isSongStarred: false,
            volume: 100,
            currentDuration: 0,
            mediaType: 'song',
            audioPlayerRef: null,
            mainDrawerState: false,
            queueState: false,
            lyricsState: false,
            hasSyncedTheCurrentTrack: false,
            hasScrobbledTheCurrentTrack: false,
            hasPrev: false,
            hasNext: false,
            infinityModeEnabled: false,
            playbackContext: {
              isSourceModified: false,
              source: null,
            },
          },
          playerProgress: {
            progress: 0,
          },
          listenTime: {
            accumulated: 0,
          },
          settings: {
            volume: {
              min: 0,
              max: 100,
              step: 1,
              wheelStep: 5,
            },
            colors: {
              currentSongColor: null,
            },
          },
          actions: {
            setSongList: (
              songlist,
              index,
              shuffle = false,
              playbackSource = null,
            ) => {
              get().actions.resetAccumulatedTime()
              get().actions.setHasSyncedTheCurrentTrack(false)
              get().actions.setHasScrobbledTheCurrentTrack(false)

              playbackBackHistory.length = 0
              infinityPendingSongIds = []
              saveInfinityPendingIds([])
              infinityPool = []
              infinityPoolSeedId = null

              const audio = get().playerState.audioPlayerRef
              if (audio) {
                audio.currentTime = 0
              }
              get().actions.resetProgress()

              set((state) => {
                state.playerState.playbackContext.source = playbackSource
                state.songlist.playNextQueue = []
                state.songlist.userQueue = []
                state.songlist.originalList = songlist
                state.songlist.originalSongIndex = index
                state.playerState.mediaType = 'song'
                state.songlist.radioList = []
              })

              if (shuffle) {
                const shuffledList = shuffleSongList(songlist, index, true)

                set((state) => {
                  state.songlist.shuffledList = shuffledList
                  state.songlist.currentList = shuffledList
                  state.songlist.currentSongIndex = 0
                  state.songlist.currentSong = shuffledList[0]
                  state.playerState.isShuffleActive = true
                  state.playerState.isPlaying = true
                })
              } else {
                set((state) => {
                  state.songlist.currentList = songlist
                  state.songlist.currentSongIndex = index
                  state.songlist.currentSong = songlist[index]
                  state.playerState.isShuffleActive = false
                  state.playerState.isPlaying = true
                })
              }

              get().actions.updateQueueChecks()
              runTopUpInfinityIfNeeded()
            },
            setCurrentSong: () => {
              const { currentList, currentSongIndex, currentSong } =
                get().songlist

              if (
                currentList.length > 0 &&
                currentSongIndex >= 0 &&
                currentSongIndex < currentList.length
              ) {
                const target = currentList[currentSongIndex]
                if (
                  target &&
                  (!currentSong?.id || currentSong.id === target.id)
                ) {
                  set((state) => {
                    state.songlist.currentSong = target
                  })
                }
              }
            },
            playSong: (song) => {
              const { isPlaying } = get().playerState
              const songIsAlreadyPlaying = get().actions.checkActiveSong(
                song.id,
              )
              if (songIsAlreadyPlaying && !isPlaying) {
                set((state) => {
                  state.playerState.isPlaying = true
                })
              } else if (songIsAlreadyPlaying && isPlaying) {
                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                }
                get().actions.resetProgress()
              } else {
                get().actions.resetProgress()
                get().actions.resetAccumulatedTime()
                get().actions.setHasSyncedTheCurrentTrack(false)
                get().actions.setHasScrobbledTheCurrentTrack(false)

                playbackBackHistory.length = 0
                infinityPendingSongIds = []
                saveInfinityPendingIds([])
                infinityPool = []
                infinityPoolSeedId = null

                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                }

                set((state) => {
                  state.playerState.mediaType = 'song'
                  state.songlist.currentList = [song]
                  state.songlist.originalList = [song]
                  state.songlist.shuffledList = [song]
                  state.songlist.currentSongIndex = 0
                  state.songlist.originalSongIndex = 0
                  state.songlist.currentSong = song
                  state.songlist.playNextQueue = []
                  state.songlist.userQueue = []
                  state.playerState.isShuffleActive = false
                  state.playerState.isPlaying = true
                  state.songlist.radioList = []
                  state.playerState.playbackContext.source = null
                })

                get().actions.updateQueueChecks()
                runTopUpInfinityIfNeeded(true)
              }
            },
            setNextOnQueue: (list) => {
              const { userQueue } = get().songlist
              const cleanedUserQueue =
                removePendingInfinitySongsFromUserQueue(userQueue)

              set((state) => {
                state.songlist.userQueue = cleanedUserQueue
                state.songlist.playNextQueue = [
                  ...state.songlist.playNextQueue,
                  ...list,
                ]
                state.playerState.playbackContext.source = null
              })

              const { isPlaying } = get().playerState
              const { currentSong } = get().songlist
              if (!isPlaying && !currentSong?.id && list.length > 0) {
                get().actions.playNextSong()
              }
              get().actions.updateQueueChecks()
            },
            setLastOnQueue: (list) => {
              const { userQueue } = get().songlist
              const cleanedUserQueue =
                removePendingInfinitySongsFromUserQueue(userQueue)

              set((state) => {
                state.songlist.userQueue = [...cleanedUserQueue, ...list]
                state.playerState.playbackContext.source = null
              })

              const { isPlaying } = get().playerState
              const { currentSong } = get().songlist
              if (!isPlaying && !currentSong?.id && list.length > 0) {
                get().actions.playNextSong()
              }
              get().actions.updateQueueChecks()
            },
            jumpToPlayNext: (index: number) => {
              const {
                playNextQueue,
                currentList,
                currentSongIndex,
                currentSong,
              } = get().songlist
              if (index < 0 || index >= playNextQueue.length) return
              const targetSong = playNextQueue[index]

              recordTransition(
                currentSong,
                targetSong,
                currentList,
                currentSongIndex,
              )

              get().actions.resetProgress()
              get().actions.resetAccumulatedTime()
              get().actions.setHasSyncedTheCurrentTrack(false)
              get().actions.setHasScrobbledTheCurrentTrack(false)

              const audio = get().playerState.audioPlayerRef
              if (audio) {
                audio.currentTime = 0
              }

              set((state) => {
                state.songlist.playNextQueue.splice(index, 1)
                state.songlist.currentSong = targetSong
                state.playerState.isPlaying = true
              })
              runTopUpInfinityIfNeeded()
              get().actions.updateQueueChecks()
            },
            jumpToQueueTrack: (queueIndex: number) => {
              const { currentList, currentSongIndex, currentSong } =
                get().songlist
              if (
                queueIndex <= currentSongIndex ||
                queueIndex >= currentList.length
              )
                return
              const targetSong = currentList[queueIndex]

              recordTransition(
                currentSong,
                targetSong,
                currentList,
                currentSongIndex,
              )

              get().actions.resetProgress()
              get().actions.resetAccumulatedTime()
              get().actions.setHasSyncedTheCurrentTrack(false)
              get().actions.setHasScrobbledTheCurrentTrack(false)

              const audio = get().playerState.audioPlayerRef
              if (audio) {
                audio.currentTime = 0
              }

              set((state) => {
                state.songlist.currentList.splice(queueIndex, 1)
                state.songlist.currentSong = targetSong
                state.playerState.isPlaying = true
              })
              runTopUpInfinityIfNeeded()
              get().actions.updateQueueChecks()
            },
            jumpToUserQueue: (index: number) => {
              const { userQueue, currentList, currentSongIndex, currentSong } =
                get().songlist
              if (index < 0 || index >= userQueue.length) return
              const targetSong = userQueue[index]

              recordTransition(
                currentSong,
                targetSong,
                currentList,
                currentSongIndex,
              )

              get().actions.resetProgress()
              get().actions.resetAccumulatedTime()
              get().actions.setHasSyncedTheCurrentTrack(false)
              get().actions.setHasScrobbledTheCurrentTrack(false)

              const audio = get().playerState.audioPlayerRef
              if (audio) {
                audio.currentTime = 0
              }

              set((state) => {
                const removed = state.songlist.userQueue.splice(index, 1)[0]
                if (removed) {
                  infinityPendingSongIds = infinityPendingSongIds.filter(
                    (id) => id !== removed.id,
                  )
                  saveInfinityPendingIds(infinityPendingSongIds)
                }
                state.songlist.currentList.push(targetSong)
                state.songlist.currentSongIndex =
                  state.songlist.currentList.length - 1
                state.songlist.currentSong = targetSong
                state.playerState.isPlaying = true
              })
              runTopUpInfinityIfNeeded()
              get().actions.updateQueueChecks()
            },
            removeFromPlayNextQueue: (index: number) => {
              set((state) => {
                if (index >= 0 && index < state.songlist.playNextQueue.length) {
                  state.songlist.playNextQueue.splice(index, 1)
                }
              })
              runTopUpInfinityIfNeeded()
              get().actions.updateQueueChecks()
            },
            removeFromPlayQueue: (queueIndex: number) => {
              const { currentSongIndex, currentList } = get().songlist
              if (queueIndex < 0 || queueIndex >= currentList.length) return
              if (queueIndex === currentSongIndex) {
                get().actions.removeSongFromQueue(currentList[queueIndex].id)
                return
              }
              set((state) => {
                state.songlist.currentList.splice(queueIndex, 1)
                if (queueIndex < state.songlist.currentSongIndex) {
                  state.songlist.currentSongIndex -= 1
                }
              })
              runTopUpInfinityIfNeeded()
              get().actions.updateQueueChecks()
            },
            removeFromUserQueue: (index: number) => {
              set((state) => {
                if (index >= 0 && index < state.songlist.userQueue.length) {
                  const removed = state.songlist.userQueue.splice(index, 1)[0]
                  if (removed) {
                    infinityPendingSongIds = infinityPendingSongIds.filter(
                      (id) => id !== removed.id,
                    )
                    saveInfinityPendingIds(infinityPendingSongIds)
                  }
                }
              })
              runTopUpInfinityIfNeeded()
              get().actions.updateQueueChecks()
            },
            moveInPlayNextQueue: (from: number, to: number) => {
              set((state) => {
                const list = state.songlist.playNextQueue
                if (from === to || !list[from] || !list[to]) return
                const [moved] = list.splice(from, 1)
                list.splice(to, 0, moved)
              })
            },
            moveInUpcomingQueue: (from: number, to: number) => {
              const { currentSongIndex } = get().songlist
              const offset = currentSongIndex + 1
              get().actions.moveSongInQueue(from + offset, to + offset)
            },
            moveInUserQueue: (from: number, to: number) => {
              set((state) => {
                const list = state.songlist.userQueue
                if (from === to || !list[from] || !list[to]) return
                const [moved] = list.splice(from, 1)
                list.splice(to, 0, moved)
              })
            },
            toggleInfinityMode: () => {
              const nextVal = !get().playerState.infinityModeEnabled
              get().actions.setInfinityMode(nextVal)
            },
            setInfinityMode: (enabled: boolean) => {
              set((state) => {
                state.playerState.infinityModeEnabled = enabled
                if (!enabled) {
                  state.songlist.userQueue =
                    removePendingInfinitySongsFromUserQueue(
                      state.songlist.userQueue,
                    )
                }
              })
              if (enabled) {
                runTopUpInfinityIfNeeded(true)
              }
            },
            topUpInfinityIfNeeded: async (startIfIdle = false) => {
              await runTopUpInfinityIfNeeded(startIfIdle)
            },
            setPlayRadio: (list, index) => {
              const { mediaType } = get().playerState
              const { radioList, currentSongIndex } = get().songlist

              if (
                mediaType === 'radio' &&
                radioList.length > 0 &&
                list[index].id === radioList[currentSongIndex].id
              ) {
                set((state) => {
                  state.playerState.isPlaying = true
                })
                return
              }

              get().actions.clearPlayerState()
              set((state) => {
                state.playerState.mediaType = 'radio'
                state.songlist.radioList = list
                state.songlist.currentSongIndex = index
                state.playerState.isPlaying = true
              })
            },
            setPlayingState: (status) => {
              set((state) => {
                state.playerState.isPlaying = status
              })
            },
            togglePlayPause: () => {
              set((state) => {
                state.playerState.isPlaying = !state.playerState.isPlaying
              })
            },
            toggleLoop: () => {
              const { loopState } = get().playerState

              // Cycles to the next state
              const newState =
                (loopState + 1) % (Object.keys(LoopState).length / 2)

              set((state) => {
                state.playerState.loopState = newState
              })
            },
            toggleShuffle: () => {
              const { isShuffleActive } = get().playerState
              const { currentList, currentSongIndex } = get().songlist

              const listLength = currentList.length
              const isPlayingOneOrLess = listLength <= 1
              const isPlayingLastSong = currentSongIndex === listLength - 1

              if (isPlayingOneOrLess || isPlayingLastSong) return

              if (isShuffleActive) {
                const currentSongId = get().songlist.currentSong.id
                const index = get().songlist.originalList.findIndex(
                  (song) => song.id === currentSongId,
                )

                set((state) => {
                  state.songlist.currentList = state.songlist.originalList
                  state.songlist.currentSongIndex = index
                  state.playerState.isShuffleActive = false
                })
              } else {
                const { currentList, currentSongIndex } = get().songlist
                const songListToShuffle = currentList.slice(currentSongIndex)
                const shuffledList = shuffleSongList(songListToShuffle, 0)

                set((state) => {
                  state.songlist.shuffledList = shuffledList
                  state.songlist.currentList = shuffledList
                  state.songlist.currentSongIndex = 0
                  state.playerState.isShuffleActive = true
                })
              }
            },
            playNextSong: () => {
              const { loopState, mediaType } = get().playerState
              const {
                resetProgress,
                playFirstSongInQueue,
                setHasSyncedTheCurrentTrack,
                setHasScrobbledTheCurrentTrack,
                resetAccumulatedTime,
              } = get().actions

              resetAccumulatedTime()
              setHasSyncedTheCurrentTrack(false)
              setHasScrobbledTheCurrentTrack(false)

              if (mediaType === 'radio') {
                const { radioList, currentSongIndex } = get().songlist
                if (currentSongIndex + 1 < radioList.length) {
                  resetProgress()
                  set((state) => {
                    state.songlist.currentSongIndex += 1
                  })
                }
                return
              }

              const {
                currentList,
                currentSongIndex,
                playNextQueue,
                userQueue,
                currentSong,
              } = get().songlist

              // Priority 1: playNextQueue
              if (playNextQueue.length > 0) {
                const targetSong = playNextQueue[0]
                recordTransition(
                  currentSong,
                  targetSong,
                  currentList,
                  currentSongIndex,
                )
                resetProgress()
                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                }
                set((state) => {
                  state.songlist.playNextQueue.shift()
                  state.songlist.currentSong = targetSong
                  state.playerState.isPlaying = true
                })
                runTopUpInfinityIfNeeded()
                get().actions.updateQueueChecks()
                return
              }

              // Priority 2: currentList upcoming (currentSongIndex + 1 < currentList.length)
              if (currentSongIndex + 1 < currentList.length) {
                const targetSong = currentList[currentSongIndex + 1]
                recordTransition(
                  currentSong,
                  targetSong,
                  currentList,
                  currentSongIndex,
                )
                resetProgress()
                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                }
                set((state) => {
                  state.songlist.currentSongIndex += 1
                  state.songlist.currentSong = targetSong
                  state.playerState.isPlaying = true
                })
                runTopUpInfinityIfNeeded()
                get().actions.updateQueueChecks()
                return
              }

              // Priority 3: userQueue (includes infinity tracks)
              if (userQueue.length > 0) {
                const targetSong = userQueue[0]
                recordTransition(
                  currentSong,
                  targetSong,
                  currentList,
                  currentSongIndex,
                )
                resetProgress()
                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                }
                set((state) => {
                  const removed = state.songlist.userQueue.shift()
                  if (removed) {
                    infinityPendingSongIds = infinityPendingSongIds.filter(
                      (id) => id !== removed.id,
                    )
                    saveInfinityPendingIds(infinityPendingSongIds)
                  }
                  state.songlist.currentList.push(targetSong)
                  state.songlist.currentSongIndex =
                    state.songlist.currentList.length - 1
                  state.songlist.currentSong = targetSong
                  state.playerState.isPlaying = true
                })
                runTopUpInfinityIfNeeded()
                get().actions.updateQueueChecks()
                return
              }

              // Priority 4: Loop All
              if (loopState === LoopState.All && currentList.length > 0) {
                const targetSong = currentList[0]
                recordTransition(
                  currentSong,
                  targetSong,
                  currentList,
                  currentSongIndex,
                )
                resetProgress()
                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                }
                playFirstSongInQueue()
                set((state) => {
                  state.songlist.currentSong = targetSong
                  state.playerState.isPlaying = true
                })
                get().actions.updateQueueChecks()
                return
              }

              // End of queue:
              set((state) => {
                state.playerState.isPlaying = false
              })
              get().actions.updateQueueChecks()
            },
            playPrevSong: () => {
              const {
                resetProgress,
                resetAccumulatedTime,
                setHasSyncedTheCurrentTrack,
                setHasScrobbledTheCurrentTrack,
              } = get().actions
              const { mediaType, audioPlayerRef } = get().playerState
              const { progress } = get().playerProgress

              resetAccumulatedTime()
              setHasSyncedTheCurrentTrack(false)
              setHasScrobbledTheCurrentTrack(false)

              if (mediaType === 'radio') {
                const { currentSongIndex } = get().songlist
                if (currentSongIndex > 0) {
                  resetProgress()
                  if (audioPlayerRef) {
                    audioPlayerRef.currentTime = 0
                  }
                  set((state) => {
                    state.songlist.currentSongIndex -= 1
                  })
                }
                return
              }

              // Shelv rule: if playing > 3s, seek to 0
              const currentTime = audioPlayerRef?.currentTime ?? progress
              if (currentTime > 3) {
                if (audioPlayerRef) {
                  audioPlayerRef.currentTime = 0
                }
                resetProgress()
                return
              }

              const { currentList, currentSongIndex, currentSong } =
                get().songlist

              // Shelv rule: if currentSong doesn't match currentList[currentSongIndex]
              // (e.g. jumped track or playNext song), return to currentList[currentSongIndex]
              if (
                currentList.length > 0 &&
                currentSongIndex >= 0 &&
                currentSongIndex < currentList.length &&
                currentSong?.id &&
                currentList[currentSongIndex].id !== currentSong.id
              ) {
                resetProgress()
                if (audioPlayerRef) {
                  audioPlayerRef.currentTime = 0
                }
                set((state) => {
                  state.songlist.currentSong =
                    state.songlist.currentList[state.songlist.currentSongIndex]
                  state.playerState.isPlaying = true
                })
                get().actions.updateQueueChecks()
                return
              }

              // Check back history first
              const historySelection = popPreviousFromHistory(currentList)
              if (historySelection) {
                resetProgress()
                if (audioPlayerRef) {
                  audioPlayerRef.currentTime = 0
                }
                set((state) => {
                  if (
                    historySelection.queueAnchorIndex !== null &&
                    historySelection.queueAnchorIndex >= 0 &&
                    historySelection.queueAnchorIndex <
                      state.songlist.currentList.length &&
                    state.songlist.currentList[
                      historySelection.queueAnchorIndex
                    ].id === historySelection.song.id
                  ) {
                    state.songlist.currentSongIndex =
                      historySelection.queueAnchorIndex
                    state.songlist.currentSong = historySelection.song
                  } else {
                    const matchIdx = state.songlist.currentList.findIndex(
                      (s) => s.id === historySelection.song.id,
                    )
                    if (matchIdx !== -1) {
                      state.songlist.currentSongIndex = matchIdx
                      state.songlist.currentSong = historySelection.song
                    } else {
                      if (
                        historySelection.queueAnchorIndex !== null &&
                        historySelection.queueAnchorIndex >= 0 &&
                        historySelection.queueAnchorIndex <
                          state.songlist.currentList.length
                      ) {
                        state.songlist.currentSongIndex =
                          historySelection.queueAnchorIndex
                      }
                      state.songlist.currentSong = historySelection.song
                    }
                  }
                  state.playerState.isPlaying = true
                })
                get().actions.updateQueueChecks()
                return
              }

              // Fallback to previous index
              if (currentSongIndex > 0) {
                resetProgress()
                if (audioPlayerRef) {
                  audioPlayerRef.currentTime = 0
                }
                set((state) => {
                  state.songlist.currentSongIndex -= 1
                  state.songlist.currentSong =
                    state.songlist.currentList[state.songlist.currentSongIndex]
                  state.playerState.isPlaying = true
                })
                get().actions.updateQueueChecks()
              }
            },
            clearPlayerState: () => {
              playbackBackHistory.length = 0
              infinityPendingSongIds = []
              saveInfinityPendingIds([])
              infinityPool = []
              infinityPoolSeedId = null

              set((state) => {
                state.songlist.originalList = []
                state.songlist.shuffledList = []
                state.songlist.currentList = []
                state.songlist.currentSong = {} as ISong
                state.songlist.radioList = []
                state.songlist.playNextQueue = []
                state.songlist.userQueue = []
                state.songlist.originalSongIndex = 0
                state.songlist.currentSongIndex = 0
                state.playerState.mediaType = 'song'
                state.playerState.isPlaying = false
                state.playerState.loopState = LoopState.Off
                state.playerState.isShuffleActive = false
                state.playerState.mainDrawerState = false
                state.playerState.queueState = false
                state.playerState.lyricsState = false
                state.playerState.hasSyncedTheCurrentTrack = false
                state.playerState.hasScrobbledTheCurrentTrack = false
                state.playerState.currentDuration = 0
                state.playerState.audioPlayerRef = null
                state.settings.colors.currentSongColor = null
                state.listenTime.accumulated = 0
                state.playerState.playbackContext.source = null
              })
            },
            resetProgress: () => {
              set((state) => {
                state.playerProgress.progress = 0
              })
            },
            setProgress: (progress) => {
              set((state) => {
                state.playerProgress.progress = progress
              })
            },
            setVolume: (volume) => {
              set((state) => {
                state.playerState.volume = volume
              })
            },
            handleVolumeWheel: (isScrollingDown) => {
              const { min, max, wheelStep } = get().settings.volume
              const { volume } = get().playerState

              if (isScrollingDown && volume === min) return
              if (!isScrollingDown && volume === max) return

              const volumeAdjustment = isScrollingDown ? -wheelStep : wheelStep
              const adjustedVolume = volume + volumeAdjustment
              const finalVolume = clamp(adjustedVolume, min, max)

              set((state) => {
                state.playerState.volume = finalVolume
              })
            },
            setCurrentDuration: (duration) => {
              set((state) => {
                state.playerState.currentDuration = duration
              })
            },
            hasNextSong: () => {
              const { mediaType } = get().playerState
              const {
                currentList,
                currentSongIndex,
                radioList,
                playNextQueue,
                userQueue,
              } = get().songlist

              if (mediaType === 'song') {
                return (
                  playNextQueue.length > 0 ||
                  currentSongIndex + 1 < currentList.length ||
                  userQueue.length > 0
                )
              }
              if (mediaType === 'radio') {
                return currentSongIndex + 1 < radioList.length
              }

              return false
            },
            hasPrevSong: () => {
              const { mediaType } = get().playerState
              const { currentSongIndex } = get().songlist

              if (mediaType === 'song') {
                return (
                  playbackBackHistory.length > 0 ||
                  currentSongIndex > 0 ||
                  get().playerProgress.progress > 3
                )
              }
              if (mediaType === 'radio') {
                return currentSongIndex > 0
              }

              return false
            },
            isPlayingOneSong: () => {
              const { currentList } = get().songlist
              return currentList.length === 1
            },
            checkActiveSong: (id: string) => {
              const currentSong = get().songlist.currentSong
              if (currentSong) {
                return id === currentSong.id
              } else {
                return false
              }
            },
            checkIsSongStarred: () => {
              const { currentList, currentSongIndex } = get().songlist
              const { mediaType } = get().playerState
              const song = currentList[currentSongIndex]

              if (mediaType === 'song' && song) {
                const isStarred = typeof song.starred === 'string'

                set((state) => {
                  state.playerState.isSongStarred = isStarred
                })
              } else {
                set((state) => {
                  state.playerState.isSongStarred = false
                })
              }
            },
            starSongInQueue: (id) => {
              const { currentList } = get().songlist
              const { mediaType } = get().playerState

              if (currentList.length === 0 && mediaType !== 'song') return

              const songIndex = currentList.findIndex((song) => song.id === id)
              if (songIndex === -1) return

              const songList = [...currentList]
              const isSongStarred =
                typeof songList[songIndex].starred === 'string'

              songList[songIndex] = {
                ...songList[songIndex],
                starred: isSongStarred ? undefined : new Date().toISOString(),
              }

              set((state) => {
                state.songlist.currentList = songList
              })
            },
            starCurrentSong: async () => {
              const { currentList, currentSongIndex } = get().songlist
              const { mediaType } = get().playerState

              if (currentList.length === 0 && mediaType !== 'song') return

              const { id, starred } = get().songlist.currentSong
              const isSongStarred = typeof starred === 'string'
              await subsonic.star.handleStarItem({
                id,
                starred: isSongStarred,
              })

              const songList = [...currentList]
              songList[currentSongIndex] = {
                ...songList[currentSongIndex],
                starred: isSongStarred ? undefined : new Date().toISOString(),
              }

              set((state) => {
                state.songlist.currentList = songList
              })
            },
            setAudioPlayerRef: (audioPlayer) => {
              set(
                produce((state: IPlayerContext) => {
                  state.playerState.audioPlayerRef = audioPlayer
                }),
              )
            },
            removeSongFromQueue: (id) => {
              const {
                currentList,
                originalList,
                shuffledList,
                currentSongIndex,
                originalSongIndex,
              } = get().songlist

              // Get the removed song index to adjust the current one.
              const removedSongIndex = currentList.findIndex(
                (song) => song.id === id,
              )
              const newCurrentList = currentList.filter(
                (song) => song.id !== id,
              )

              // Clear player state if list is empty
              if (newCurrentList.length === 0) {
                get().actions.clearPlayerState()
                return
              }

              // In case of removing current song, resets the progress
              if (removedSongIndex === currentSongIndex) {
                get().actions.resetProgress()
              }

              const newOriginalList = originalList.filter(
                (song) => song.id !== id,
              )
              const newShuffledList = shuffledList.filter(
                (song) => song.id !== id,
              )

              // Update index to fit new current list
              const updatedCurrentIndex = Math.min(
                currentSongIndex -
                  (removedSongIndex < currentSongIndex ? 1 : 0),
                newCurrentList.length - 1,
              )

              // Update original index
              const removedOriginalIndex = originalList.findIndex(
                (song) => song.id === id,
              )
              const updatedOriginalIndex = Math.min(
                originalSongIndex -
                  (removedOriginalIndex < originalSongIndex ? 1 : 0),
                newOriginalList.length - 1,
              )

              set((state) => {
                state.songlist.currentList = newCurrentList
                state.songlist.originalList = newOriginalList
                state.songlist.shuffledList = newShuffledList
                state.songlist.currentSongIndex = updatedCurrentIndex
                state.songlist.originalSongIndex = updatedOriginalIndex
              })
            },
            // Removes every song from the queue except the one playing
            clearQueue: () => {
              const { currentList, currentSongIndex } = get().songlist
              const current = currentList[currentSongIndex]

              infinityPendingSongIds = []
              saveInfinityPendingIds([])
              infinityPool = []
              infinityPoolSeedId = null

              if (!current) {
                get().actions.clearPlayerState()
                return
              }

              set((state) => {
                state.songlist.playNextQueue = []
                state.songlist.userQueue = []
                state.songlist.currentList = [current]
                state.songlist.originalList = [current]
                state.songlist.shuffledList = [current]
                state.songlist.currentSongIndex = 0
                state.songlist.originalSongIndex = 0
                state.playerState.playbackContext.source = null
              })
              get().actions.updateQueueChecks()
              if (get().playerState.infinityModeEnabled) {
                runTopUpInfinityIfNeeded()
              }
            },
            moveSongInQueue: (from, to) => {
              const { currentList, currentSongIndex } = get().songlist
              const { isShuffleActive } = get().playerState

              if (from === to || !currentList[from] || !currentList[to]) return

              const newList = [...currentList]
              const [moved] = newList.splice(from, 1)
              newList.splice(to, 0, moved)

              // keep the playing song selected at its new position
              let newIndex = currentSongIndex
              if (from === currentSongIndex) newIndex = to
              else if (from < currentSongIndex && to >= currentSongIndex)
                newIndex -= 1
              else if (from > currentSongIndex && to <= currentSongIndex)
                newIndex += 1

              set((state) => {
                state.songlist.currentList = newList
                state.songlist.currentSongIndex = newIndex
                state.playerState.playbackContext.isSourceModified = true

                if (isShuffleActive) {
                  state.songlist.shuffledList = newList
                } else {
                  state.songlist.originalList = newList
                  state.songlist.originalSongIndex = newIndex
                }
              })
              get().actions.updateQueueChecks()
            },
            setMainDrawerState: (status) => {
              set((state) => {
                state.playerState.mainDrawerState = status
              })
            },
            setQueueState: (status) => {
              set((state) => {
                state.playerState.queueState = status
              })
            },
            toggleQueueAction: () => {
              const { mainDrawerState, lyricsState, queueState } =
                get().playerState
              const {
                toggleQueueAndLyrics,
                setQueueState,
                setMainDrawerState,
              } = get().actions

              if (mainDrawerState && lyricsState) {
                toggleQueueAndLyrics()
              } else {
                setQueueState(!queueState)
                setMainDrawerState(!mainDrawerState)
              }
            },
            setLyricsState: (status) => {
              set((state) => {
                state.playerState.lyricsState = status
              })
            },
            toggleLyricsAction: () => {
              const { mainDrawerState, lyricsState, queueState } =
                get().playerState
              const {
                toggleQueueAndLyrics,
                setLyricsState,
                setMainDrawerState,
              } = get().actions

              if (mainDrawerState && queueState) {
                toggleQueueAndLyrics()
              } else {
                setLyricsState(!lyricsState)
                setMainDrawerState(!mainDrawerState)
              }
            },
            toggleQueueAndLyrics: () => {
              const { queueState, lyricsState } = get().playerState

              set((state) => {
                state.playerState.queueState = !queueState
                state.playerState.lyricsState = !lyricsState
              })
            },
            closeDrawer: () => {
              set((state) => {
                state.playerState.mainDrawerState = false
                state.playerState.queueState = false
                state.playerState.lyricsState = false
              })
            },
            setHasSyncedTheCurrentTrack: (value) => {
              set((state) => {
                state.playerState.hasSyncedTheCurrentTrack = value
              })
            },
            setHasScrobbledTheCurrentTrack: (value) => {
              set((state) => {
                state.playerState.hasScrobbledTheCurrentTrack = value
              })
            },
            incrementAccumulatedTime: (delta) => {
              set((state) => {
                state.listenTime.accumulated += delta
              })
            },
            resetAccumulatedTime: () => {
              set((state) => {
                state.listenTime.accumulated = 0
              })
            },
            playFirstSongInQueue: () => {
              set((state) => {
                state.songlist.currentSongIndex = 0
              })
            },
            handleSongEnded: () => {
              const { loopState } = get().playerState
              const {
                hasNextSong,
                playNextSong,
                setPlayingState,
                clearPlayerState,
                resetProgress,
              } = get().actions

              if (loopState === LoopState.One) {
                resetProgress()
                setPlayingState(true)
                const audio = get().playerState.audioPlayerRef
                if (audio) {
                  audio.currentTime = 0
                  audio.play().catch(() => {})
                }
                return
              }

              if (hasNextSong() || loopState === LoopState.All) {
                playNextSong()
                setPlayingState(true)
              } else {
                clearPlayerState()
                setPlayingState(false)
              }
            },
            getCurrentProgress: () => {
              return get().playerProgress.progress
            },
            updateQueueChecks: () => {
              const { hasPrevSong, hasNextSong } = get().actions

              set((state) => {
                state.playerState.hasPrev = hasPrevSong()
                state.playerState.hasNext = hasNextSong()
              })
            },
            setCurrentSongColor: (value) => {
              set((state) => {
                state.settings.colors.currentSongColor = value
              })
            },
          },
        })),
        { name: 'player_store' },
      ),
      {
        name: 'player_store',
        version: 1,
        merge: (persistedState, currentState) => {
          let merged = merge(currentState, persistedState)

          idbStorage.getItem<ISongList>(miniStores.songlist, (value) => {
            if (!value) return

            const newState = {
              songlist: value,
            }

            merged = merge(merged, newState)
          })

          return merged
        },
        partialize: (state) => {
          const appStore = omit(state, [
            'songlist',
            'actions',
            'playerState.isPlaying',
            'playerState.audioPlayerRef',
            'playerState.mainDrawerState',
            'playerState.queueState',
            'playerState.lyricsState',
          ])

          return appStore
        },
      },
    ),
  ),
  shallow,
)

usePlayerStore.subscribe(
  (state) => [state.songlist],
  ([songlist]) => {
    idbStorage.setItem(miniStores.songlist, songlist)
  },
  {
    equalityFn: shallow,
  },
)

usePlayerStore.subscribe(
  (state) => [state.songlist.currentList, state.songlist.currentSongIndex],
  () => {
    const playerStore = usePlayerStore.getState()
    const { mediaType } = playerStore.playerState
    if (mediaType === 'radio') return

    playerStore.actions.checkIsSongStarred()
    playerStore.actions.setCurrentSong()

    const { currentList } = playerStore.songlist
    const { progress } = playerStore.playerProgress

    const isSonglistEmpty = currentList.length === 0

    if (isSonglistEmpty && progress > 0) {
      playerStore.actions.resetProgress()
    }
  },
  {
    equalityFn: shallow,
  },
)

usePlayerStore.subscribe(
  ({ songlist }) => [
    songlist.currentList,
    songlist.radioList,
    songlist.currentSongIndex,
  ],
  () => {
    usePlayerStore.getState().actions.updateQueueChecks()
  },
  {
    equalityFn: shallow,
  },
)

let prevObservedTrackId: string | undefined

usePlayerStore.subscribe(
  (state) => state.songlist.currentSong?.id,
  (currentSongId) => {
    if (!currentSongId) {
      prevObservedTrackId = undefined
      return
    }
    if (currentSongId === prevObservedTrackId) return
    prevObservedTrackId = currentSongId

    if (infinityPendingSongIds.includes(currentSongId)) {
      infinityPendingSongIds = infinityPendingSongIds.filter(
        (id) => id !== currentSongId,
      )
      saveInfinityPendingIds(infinityPendingSongIds)
    }

    if (usePlayerStore.getState().playerState.infinityModeEnabled) {
      runTopUpInfinityIfNeeded()
    }
  },
)

usePlayerStore.subscribe((state, prevState) => {
  const currentSong = state.songlist.currentSong ?? null

  if (!currentSong) return

  const progress = state.playerProgress.progress
  const prevProgress = prevState.playerProgress.progress
  const duration = currentSong.duration
  const isPlaying = state.playerState.isPlaying

  const hasSynced = state.playerState.hasSyncedTheCurrentTrack

  if (progress >= 1 && prevProgress < 1 && !hasSynced) {
    usePlayerStore.getState().actions.setHasSyncedTheCurrentTrack(true)

    scrobble.send(currentSong.id, false)
  }

  const timeDelta = progress - prevProgress

  if (isPlaying && timeDelta > 0 && timeDelta <= 2) {
    usePlayerStore.getState().actions.incrementAccumulatedTime(timeDelta)
  }

  const accumulatedTime = usePlayerStore.getState().listenTime.accumulated

  const scrobblePercent = appConfig.scrobbleCount ?? 30
  const thresholdDuration = (duration * scrobblePercent) / 100
  const fourMinutesInSeconds = 60 * 4
  const targetTime = Math.min(thresholdDuration, fourMinutesInSeconds)

  const hasScrobbled =
    usePlayerStore.getState().playerState.hasScrobbledTheCurrentTrack

  if (duration > 0 && accumulatedTime >= targetTime && !hasScrobbled) {
    usePlayerStore.getState().actions.setHasScrobbledTheCurrentTrack(true)

    scrobble.send(currentSong.id, true)
  }
})

export const usePlayerActions = () => usePlayerStore((state) => state.actions)

export const usePlayerSonglist = () =>
  usePlayerStore((state) => {
    const { currentList, currentSong, currentSongIndex, radioList } =
      state.songlist

    return {
      currentList,
      currentSong,
      currentSongIndex,
      radioList,
    }
  })

export const usePlayerCurrentSong = () =>
  usePlayerStore((state) => state.songlist.currentSong)

export const usePlayerCurrentSongIndex = () =>
  usePlayerStore((state) => state.songlist.currentSongIndex)

export const usePlayerProgress = () =>
  usePlayerStore((state) => state.playerProgress.progress)

export const usePlayerVolume = () => ({
  volume: usePlayerStore((state) => state.playerState.volume),
  setVolume: usePlayerStore((state) => state.actions.setVolume),
  handleVolumeWheel: usePlayerStore((state) => state.actions.handleVolumeWheel),
})

export const useVolumeSettings = () =>
  usePlayerStore((state) => state.settings.volume)

export const usePlayerSettings = () => usePlayerStore((state) => state.settings)

export const usePlayerMediaType = () => {
  const mediaType = usePlayerStore((state) => state.playerState.mediaType)
  const isSong = mediaType === 'song'
  const isRadio = mediaType === 'radio'

  return {
    isSong,
    isRadio,
  }
}

export const usePlayerIsPlaying = () =>
  usePlayerStore((state) => state.playerState.isPlaying)

export const usePlayerDuration = () =>
  usePlayerStore((state) => state.playerState.currentDuration)

export const usePlayerSongStarred = () =>
  usePlayerStore((state) => state.playerState.isSongStarred)

export const usePlayerShuffle = () =>
  usePlayerStore((state) => state.playerState.isShuffleActive)

export const usePlayerLoop = () =>
  usePlayerStore((state) => state.playerState.loopState)

export const usePlayerPrevAndNext = () =>
  usePlayerStore((state) => ({
    hasPrev: state.playerState.hasPrev,
    hasNext: state.playerState.hasNext,
  }))

export const usePlayerRef = () =>
  usePlayerStore((state) => state.playerState.audioPlayerRef)

export const getVolume = () => usePlayerStore.getState().playerState.volume

export const useMainDrawerState = () =>
  usePlayerStore((state) => ({
    mainDrawerState: state.playerState.mainDrawerState,
    setMainDrawerState: state.actions.setMainDrawerState,
    toggleQueueAndLyrics: state.actions.toggleQueueAndLyrics,
    closeDrawer: state.actions.closeDrawer,
  }))

export const useQueueState = () =>
  usePlayerStore((state) => ({
    queueState: state.playerState.queueState,
    setQueueState: state.actions.setQueueState,
    toggleQueueAction: state.actions.toggleQueueAction,
  }))

export const useLyricsState = () =>
  usePlayerStore((state) => ({
    lyricsState: state.playerState.lyricsState,
    setLyricsState: state.actions.setLyricsState,
    toggleLyricsAction: state.actions.toggleLyricsAction,
  }))

export const useSongColor = () =>
  usePlayerStore((state) => {
    const { currentSongColor } = state.settings.colors
    const { setCurrentSongColor } = state.actions

    return {
      currentSongColor,
      setCurrentSongColor,
    }
  })

export const usePlayerCurrentList = () =>
  usePlayerStore((state) => state.songlist.currentList)

export const usePlayerContext = () =>
  usePlayerStore((state) => state.playerState.playbackContext)

const useContextVerification = (id: string, type: PlaybackSourceType) => {
  const { source } = usePlayerStore(
    (state) => state.playerState.playbackContext,
  )
  const isPlayerPlaying = usePlayerStore((state) => state.playerState.isPlaying)

  if (!source) return { isActive: false, isPlaying: false }

  const isActive = source.type === type && source.id === id
  const isPlaying = isActive && isPlayerPlaying

  return { isActive, isPlaying }
}

export const useIsPlaylistPlaying = (playlistId: string) => {
  const { isActive, isPlaying } = useContextVerification(playlistId, 'playlist')

  return {
    isPlaylistActive: isActive,
    isPlaylistPlaying: isPlaying,
  }
}

export const useIsAlbumPlaying = (albumId: string) => {
  const { isActive, isPlaying } = useContextVerification(albumId, 'album')

  return {
    isAlbumActive: isActive,
    isAlbumPlaying: isPlaying,
  }
}

export const useIsArtistPlaying = (artistId: string) => {
  const { isActive, isPlaying } = useContextVerification(artistId, 'artist')

  return {
    isArtistActive: isActive,
    isArtistPlaying: isPlaying,
  }
}

export const useIsSingleSongPlaying = (songId: string) => {
  const playingSongId = usePlayerStore((state) => state.songlist.currentSong.id)
  const { source } = usePlayerStore(
    (store) => store.playerState.playbackContext,
  )
  const isPlayerPlaying = usePlayerStore((state) => state.playerState.isPlaying)

  if (source) return { isSongPlaying: false }

  const isSongActive = playingSongId === songId
  const isSongPlaying = isSongActive && isPlayerPlaying

  return {
    isSongActive,
    isSongPlaying,
  }
}

export const usePlayerPlayNextQueue = () =>
  usePlayerStore((state) => state.songlist.playNextQueue)

export const usePlayerUserQueue = () =>
  usePlayerStore((state) => state.songlist.userQueue)

export const usePlayerUpcomingAlbumQueue = () =>
  usePlayerStore((state) => {
    const { currentList, currentSongIndex } = state.songlist
    return currentList.slice(currentSongIndex + 1)
  })

export const usePlayerInfinityMode = () =>
  usePlayerStore((state) => state.playerState.infinityModeEnabled)
