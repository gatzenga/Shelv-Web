import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { usePlayerActions } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import { topSongsShown } from '@/utils/listSizes'
import { TopSongRow } from './top-song-row'

interface TopSongsProps {
  topSongs: ISong[]
  // the page with all of them
  titleRoute: string
}

export default function ArtistTopSongs({
  topSongs,
  titleRoute,
}: TopSongsProps) {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()

  const songsToShow = topSongs.slice(0, topSongsShown)
  const half = Math.ceil(songsToShow.length / 2)
  const col1 = songsToShow.slice(0, half)
  const col2 = songsToShow.slice(half)

  if (songsToShow.length === 0) return null

  function renderSongRow(song: ISong, index: number) {
    return (
      <TopSongRow
        key={song.id}
        song={song}
        index={index}
        onPlay={() => setSongList(songsToShow, index)}
      />
    )
  }

  return (
    <div className="w-full mb-6">
      <Link
        to={titleRoute}
        className="mb-3 flex items-center gap-1 w-fit hover:text-primary transition-colors"
      >
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t('artist.topSongs')}
        </h3>
        <ChevronRightIcon className="size-6 text-muted-foreground" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex flex-col gap-1">
          {col1.map((song, i) => renderSongRow(song, i))}
        </div>
        {col2.length > 0 && (
          <div className="flex flex-col gap-1">
            {col2.map((song, i) => renderSongRow(song, half + i))}
          </div>
        )}
      </div>
    </div>
  )
}
