import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useMatches } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getBackendUrl } from '@/api/httpClient'
import { subsonic } from '@/service/subsonic'
import { usePlayerActions } from '@/store/player.store'
import { usePlaylistRemoveSong } from '@/store/playlists.store'
import { useSongInfo } from '@/store/ui.store'
import { PlaybackSource } from '@/types/playerContext'
import { UpdateParams } from '@/types/responses/playlist'
import { ISong } from '@/types/responses/song'
import { logger } from '@/utils/logger'
import { queryKeys } from '@/utils/queryKeys'

type SongIdToAdd = Pick<UpdateParams, 'songIdToAdd'>['songIdToAdd']

export type InstantMixKind = 'song' | 'album' | 'artist'

export function useOptions() {
  const { t } = useTranslation()
  const { setNextOnQueue, setLastOnQueue, setSongList } = usePlayerActions()
  const { setActionData, setConfirmDialogState } = usePlaylistRemoveSong()
  const matches = useMatches()
  const { setSongId, setModalOpen } = useSongInfo()

  const isOnPlaylistPage = matches.find((route) => route.id === 'playlist')
  const playlistId = isOnPlaylistPage?.params.playlistId ?? ''

  const queryClient = useQueryClient()

  function play(list: ISong[], source?: PlaybackSource) {
    setSongList(list, 0, false, source)
  }

  function playNext(list: ISong[]) {
    setNextOnQueue(list)
  }

  function playLast(list: ISong[]) {
    setLastOnQueue(list)
  }

  // Built by the backend like in the Shelv player (server/instant-mix.ts)
  async function startInstantMix(kind: InstantMixKind, id: string) {
    const toastId = toast.loading(t('instantMix.loading'))

    try {
      const response = await fetch(
        getBackendUrl('/api/instant-mix', { kind, id }),
        { cache: 'no-store' },
      )
      if (!response.ok) throw new Error(`instant mix: ${response.status}`)

      const { songs } = (await response.json()) as { songs: ISong[] }

      if (songs.length === 0) {
        toast.update(toastId, {
          render: t('instantMix.empty'),
          type: 'info',
          isLoading: false,
          autoClose: 4000,
        })
        return
      }

      toast.dismiss(toastId)
      setSongList(songs, 0, false, {
        id: `instant-mix-${kind}-${id}`,
        name: t('options.instantMix'),
        type: 'songs',
      })
    } catch (error) {
      logger.error('[InstantMix] loading failed', error)
      toast.update(toastId, {
        render: t('instantMix.error'),
        type: 'error',
        isLoading: false,
        autoClose: 4000,
      })
    }
  }

  const updateMutation = useMutation({
    mutationFn: subsonic.playlists.update,
    onSuccess: () => {
      if (isOnPlaylistPage) {
        queryClient.invalidateQueries({
          queryKey: [queryKeys.playlist.single, playlistId],
        })
      }
    },
  })

  async function addToPlaylist(id: string, songIdToAdd: SongIdToAdd) {
    await updateMutation.mutateAsync({
      playlistId: id,
      songIdToAdd,
    })
  }

  const createMutation = useMutation({
    mutationFn: subsonic.playlists.createWithDetails,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.playlist.all],
      })
    },
  })

  async function createNewPlaylist(name: string, songIdToAdd: SongIdToAdd) {
    await createMutation.mutateAsync({
      name,
      comment: '',
      isPublic: 'false',
      songIdToAdd,
    })
  }

  function removeSongFromPlaylist(songIndexes: string[]) {
    setActionData({
      playlistId,
      songIndexes,
    })
    setConfirmDialogState(true)
  }

  function openSongInfo(id: string) {
    setSongId(id)
    setModalOpen(true)
  }

  return {
    play,
    playNext,
    playLast,
    startInstantMix,
    addToPlaylist,
    createNewPlaylist,
    removeSongFromPlaylist,
    openSongInfo,
    isOnPlaylistPage,
    playlistId,
  }
}
