import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CommandGroup, CommandItem } from '@/app/components/ui/command'
import { ROUTES } from '@/routes/routesList'
import { Albums } from '@/types/responses/album'
import {
  CustomGroup,
  CustomGroupHeader,
  CustomHeaderLink,
} from './command-group'
import { CommandItemProps } from './command-menu'
import { ResultItem } from './result-item'

type AlbumResultProps = CommandItemProps & {
  query: string
  albums: Albums[]
}

export function CommandAlbumResult({
  query,
  albums,
  runCommand,
}: AlbumResultProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <CustomGroup>
      <CustomGroupHeader>
        <span>{t('sidebar.albums')}</span>
        <CustomHeaderLink
          onClick={() =>
            runCommand(() => navigate(ROUTES.ALBUMS.SEARCH(query)))
          }
        >
          {t('generic.seeMore')}
        </CustomHeaderLink>
      </CustomGroupHeader>
      <CommandGroup>
        {albums.length > 0 &&
          albums.map((album) => (
            <AlbumResultItem
              key={`album-${album.id}`}
              album={album}
              runCommand={runCommand}
            />
          ))}
      </CommandGroup>
    </CustomGroup>
  )
}

type AlbumResultItemProps = CommandItemProps & {
  album: Albums
}

function AlbumResultItem({ album, runCommand }: AlbumResultItemProps) {
  const navigate = useNavigate()

  return (
    <CommandItem
      value={`album-${album.id}`}
      className="border mb-1 cursor-pointer"
      onSelect={() => {
        runCommand(() => navigate(ROUTES.ALBUM.PAGE(album.id)))
      }}
    >
      <ResultItem
        coverArt={album.coverArt}
        coverArtType="album"
        title={album.name}
        artist={album.artist}
      />
    </CommandItem>
  )
}
