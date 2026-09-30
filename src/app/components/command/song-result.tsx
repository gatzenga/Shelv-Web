import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CommandGroup, CommandItem } from '@/app/components/ui/command'
import { ROUTES } from '@/routes/routesList'
import { useIsSingleSongPlaying, usePlayerActions } from '@/store/player.store'
import { ISong } from '@/types/responses/song'
import {
  CustomGroup,
  CustomGroupHeader,
  CustomHeaderLink,
} from './command-group'
import { CommandItemProps } from './command-menu'
import { ResultItem } from './result-item'

type SongResultProps = CommandItemProps & {
  query: string
  songs: ISong[]
}

export function CommandSongResult({
  query,
  songs,
  runCommand,
}: SongResultProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <CustomGroup>
      <CustomGroupHeader>
        <span>{t('sidebar.songs')}</span>
        <CustomHeaderLink
          onClick={() => runCommand(() => navigate(ROUTES.SONGS.SEARCH(query)))}
        >
          {t('generic.seeMore')}
        </CustomHeaderLink>
      </CustomGroupHeader>
      <CommandGroup>
        {songs.length > 0 &&
          songs.map((song) => (
            <SongResultItem
              key={`song-${song.id}`}
              song={song}
              runCommand={runCommand}
            />
          ))}
      </CommandGroup>
    </CustomGroup>
  )
}

type SongResultItemProps = CommandItemProps & {
  song: ISong
}

function SongResultItem({ song, runCommand }: SongResultItemProps) {
  const { playSong } = usePlayerActions()
  const { isSongPlaying } = useIsSingleSongPlaying(song.id)

  function handleSelectSong() {
    playSong(song)
  }

  return (
    <CommandItem
      value={`song-${song.id}`}
      className="border mb-1 cursor-pointer"
      onSelect={() => {
        runCommand(() => {
          handleSelectSong()
        })
      }}
    >
      <ResultItem
        coverArt={song.coverArt}
        coverArtType="song"
        title={song.title}
        artist={song.artist}
        isPlaying={isSongPlaying}
      />
    </CommandItem>
  )
}
