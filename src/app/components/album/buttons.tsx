import { useMutation, useQueryClient } from '@tanstack/react-query'
import { subsonic } from '@/service/subsonic'
import { useAppPages } from '@/store/app.store'
import {
  useIsAlbumPlaying,
  usePlayerActions,
  usePlayerStore,
} from '@/store/player.store'
import { PlaybackSource } from '@/types/playerContext'
import { SingleAlbum } from '@/types/responses/album'
import { queryKeys } from '@/utils/queryKeys'
import { AlbumActionButtons } from './action-buttons'

interface AlbumButtonsProps {
  album: SingleAlbum
  showInfoButton: boolean
}

export function AlbumButtons({ album, showInfoButton }: AlbumButtonsProps) {
  const { setSongList, toggleShuffle } = usePlayerActions()
  const { showInfoPanel, toggleShowInfoPanel } = useAppPages()
  const { isAlbumActive } = useIsAlbumPlaying(album.id)
  const isShuffleActive = usePlayerStore(
    (state) => state.playerState.isShuffleActive,
  )
  const isAlbumStarred = album.starred !== undefined

  const queryClient = useQueryClient()

  const starMutation = useMutation({
    mutationFn: subsonic.star.handleStarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.album.single, album.id],
      })
    },
  })

  function handleLikeButton() {
    if (!album) return

    starMutation.mutate({
      id: album.id,
      starred: isAlbumStarred,
    })
  }

  const playbackSource: PlaybackSource = {
    id: album.id,
    name: album.name,
    type: 'album',
  }

  function handlePlayButton() {
    setSongList(album.song, 0, false, playbackSource)
  }

  function handleShuffleButton() {
    if (isAlbumActive) {
      toggleShuffle()
    } else {
      setSongList(album.song, 0, true, playbackSource)
    }
  }

  return (
    <AlbumActionButtons
      album={album}
      isAlbumActive={isAlbumActive}
      isShuffleActive={isShuffleActive}
      isStarred={isAlbumStarred}
      showInfoButton={showInfoButton}
      infoShown={showInfoPanel}
      onPlay={handlePlayButton}
      onShuffle={handleShuffleButton}
      onToggleStar={handleLikeButton}
      onToggleInfo={toggleShowInfoPanel}
    />
  )
}
