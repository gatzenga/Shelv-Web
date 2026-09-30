import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HeartIcon,
  ListEndIcon,
  ListPlusIcon,
  Loader2Icon,
  PlayIcon,
  Share2Icon,
  ShuffleIcon,
  SparklesIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { Action, PlaylistAction } from '@/app/components/album/action-buttons'
import { Button } from '@/app/components/ui/button'
import { SimpleTooltip } from '@/app/components/ui/simple-tooltip'
import { useOptions } from '@/app/hooks/use-options'
import { useShare } from '@/app/hooks/use-share'
import { useSongList } from '@/app/hooks/use-song-list'
import { cn } from '@/lib/utils'
import { subsonic } from '@/service/subsonic'
import { useAppStore } from '@/store/app.store'
import {
  useIsArtistPlaying,
  usePlayerActions,
  usePlayerStore,
} from '@/store/player.store'
import { Albums } from '@/types/responses/album'
import { IArtist } from '@/types/responses/artist'
import { ISong } from '@/types/responses/song'
import { queryKeys } from '@/utils/queryKeys'

const SpinnerIcon = ({ className }: { className?: string }) => (
  <Loader2Icon className={cn(className, 'animate-spin')} />
)

interface ArtistButtonsProps {
  artist: IArtist
  isArtistEmpty: boolean
  topSongs?: ISong[]
  sortedAlbums?: Albums[]
}

// The same buttons as on the album screen, for all songs of the artist
export function ArtistButtons({
  artist,
  isArtistEmpty,
  topSongs,
  sortedAlbums,
}: ArtistButtonsProps) {
  const { t } = useTranslation()
  const { setSongList, toggleShuffle } = usePlayerActions()
  const { getArtistPlayOrderSongs } = useSongList()
  const { playNext, playLast, startInstantMix } = useOptions()
  const { share } = useShare()
  const { isArtistActive } = useIsArtistPlaying(artist.id)
  const isShuffleActive = usePlayerStore(
    (state) => state.playerState.isShuffleActive,
  )
  const pages = useAppStore().pages
  const isArtistStarred = artist.starred !== undefined
  const [loadingSongs, setLoadingSongs] = useState(false)

  const queryClient = useQueryClient()

  const starMutation = useMutation({
    mutationFn: subsonic.star.handleStarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.artist.single, artist.id],
      })
    },
  })

  async function loadSongs(): Promise<ISong[]> {
    setLoadingSongs(true)
    try {
      return await getArtistPlayOrderSongs({
        artistId: artist.id,
        artistName: artist.name,
        sortedAlbums,
        topSongs,
      })
    } finally {
      setLoadingSongs(false)
    }
  }

  async function playArtist(shuffle = false) {
    const songs = await loadSongs()
    if (songs.length === 0) return

    setSongList(songs, 0, shuffle, {
      id: artist.id,
      name: artist.name,
      type: 'artist',
    })
  }

  function handleShuffleButton() {
    if (isArtistActive) {
      toggleShuffle()
    } else {
      playArtist(true)
    }
  }

  async function addToQueue(
    add: (songs: ISong[]) => void,
    messageKey: 'addedToPlayNext' | 'addedToQueue',
  ) {
    const songs = await loadSongs()
    if (songs.length === 0) return

    add(songs)
    toast.success(t(`album.actions.${messageKey}`))
  }

  function handleLikeButton() {
    starMutation.mutate({
      id: artist.id,
      starred: isArtistStarred,
    })
  }

  if (isArtistEmpty) {
    return <div className="h-8 w-full" />
  }

  const PlayStateIcon = loadingSongs ? SpinnerIcon : PlayIcon

  return (
    <div className="@container/actions w-full mb-6">
      <div className="flex flex-wrap items-center gap-1.5 @[28rem]/actions:gap-2.5">
        <Action
          icon={PlayStateIcon}
          label={t('options.play')}
          onClick={() => playArtist()}
          prominent
        />

        <Action
          icon={ShuffleIcon}
          label={t('album.actions.shuffle')}
          onClick={handleShuffleButton}
          active={isArtistActive && isShuffleActive}
        />

        <Action
          icon={SparklesIcon}
          label={t('options.instantMix')}
          onClick={() => startInstantMix('artist', artist.id)}
        />

        <Action
          icon={ListPlusIcon}
          label={t('options.playNext')}
          onClick={() => addToQueue(playNext, 'addedToPlayNext')}
        />
        <Action
          icon={ListEndIcon}
          label={t('options.addLast')}
          onClick={() => addToQueue(playLast, 'addedToQueue')}
        />

        {!pages.hidePlaylistsSection && (
          <PlaylistAction
            name={artist.name}
            getSongIds={async () => (await loadSongs()).map((song) => song.id)}
          />
        )}

        <Action
          icon={Share2Icon}
          label={t('options.share')}
          onClick={() => share(artist.id)}
        />

        {!pages.hideFavoritesSection && (
          <SimpleTooltip
            text={
              isArtistStarred
                ? t('album.buttons.dislike', { name: artist.name })
                : t('album.buttons.like', { name: artist.name })
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={handleLikeButton}
              className="size-9 shrink-0 rounded-full p-0 @[28rem]/actions:size-10"
            >
              <HeartIcon
                className={cn(
                  'size-5',
                  isArtistStarred && 'fill-red-500 text-red-500',
                )}
              />
            </Button>
          </SimpleTooltip>
        )}
      </div>
    </div>
  )
}
