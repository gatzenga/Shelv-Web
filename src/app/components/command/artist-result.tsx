import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CommandGroup, CommandItem } from '@/app/components/ui/command'
import { ROUTES } from '@/routes/routesList'
import { ISimilarArtist } from '@/types/responses/artist'
import { CustomGroup, CustomGroupHeader } from './command-group'
import { CommandItemProps } from './command-menu'
import { ResultItem } from './result-item'

type ArtistResultProps = CommandItemProps & {
  artists: ISimilarArtist[]
}

export function CommandArtistResult({
  artists,
  runCommand,
}: ArtistResultProps) {
  const { t } = useTranslation()

  return (
    <CustomGroup>
      <CustomGroupHeader>
        <span>{t('sidebar.artists')}</span>
      </CustomGroupHeader>
      <CommandGroup>
        {artists.length > 0 &&
          artists.map((artist) => (
            <ArtistResultItem
              key={`artist-${artist.id}`}
              artist={artist}
              runCommand={runCommand}
            />
          ))}
      </CommandGroup>
    </CustomGroup>
  )
}

type ArtistResultItemProps = CommandItemProps & {
  artist: ISimilarArtist
}

function ArtistResultItem({ artist, runCommand }: ArtistResultItemProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <CommandItem
      value={`artist-${artist.id}`}
      className="border mb-1 cursor-pointer"
      onSelect={() => {
        runCommand(() => navigate(ROUTES.ARTIST.PAGE(artist.id)))
      }}
    >
      <ResultItem
        coverArt={artist.coverArt}
        coverArtType="artist"
        title={artist.name}
        artist={t('artist.info.albumsCount', {
          count: artist.albumCount,
        })}
      />
    </CommandItem>
  )
}
