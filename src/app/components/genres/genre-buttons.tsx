import { Disc3Icon, ShuffleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Action } from '@/app/components/album/action-buttons'
import { subsonic } from '@/service/subsonic'
import { usePlayerActions } from '@/store/player.store'

interface GenreButtonsProps {
  genre: string
}

export function GenreButtons({ genre }: GenreButtonsProps) {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()

  async function handleShuffleTracks() {
    const songs = await subsonic.genres.getSongsByGenre({ genre })

    if (songs && songs.length > 0) {
      setSongList(songs, 0, true)
    }
  }

  async function handleShuffleAlbums() {
    const songs = await subsonic.songs.getRandomSongs({ genre, size: 500 })

    if (songs && songs.length > 0) {
      setSongList(songs, 0, false)
    }
  }

  return (
    <div className="@container/actions w-full mb-6">
      <div className="flex flex-wrap items-center gap-1.5 @[28rem]/actions:gap-2.5">
        <Action
          icon={ShuffleIcon}
          label={t('genres.buttons.shuffleTracks')}
          onClick={handleShuffleTracks}
          prominent
        />
        <Action
          icon={Disc3Icon}
          label={t('genres.buttons.shuffleAlbums')}
          onClick={handleShuffleAlbums}
        />
      </div>
    </div>
  )
}
