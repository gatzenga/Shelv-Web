import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DetailHeader } from '@/app/components/detail/header'
import { ROUTES } from '@/routes/routesList'
import { SingleAlbum } from '@/types/responses/album'

interface AlbumHeaderProps {
  album: SingleAlbum
  // The action buttons, below the texts
  children: ReactNode
}

// The top of an album: the title, the artist in the accent color and the year
export function AlbumHeader({ album, children }: AlbumHeaderProps) {
  const artists =
    album.artists && album.artists.length > 1
      ? album.artists
      : album.artistId
        ? [{ id: album.artistId, name: album.artist }]
        : []

  const details = [album.year ? String(album.year) : null, album.genre || null]
    .filter(Boolean)
    .join(' · ')

  return (
    <DetailHeader
      coverArtId={album.coverArt}
      coverArtType="album"
      title={album.name}
      actions={children}
    >
      {artists.length > 0 ? (
        <p className="text-xl font-medium">
          {artists.map(({ id, name }, index) => (
            <span key={id}>
              {index > 0 && ', '}
              <Link
                to={ROUTES.ARTIST.PAGE(id)}
                className="text-primary hover:underline"
                data-testid="album-artist-link"
              >
                {name}
              </Link>
            </span>
          ))}
        </p>
      ) : (
        album.artist && (
          <p className="text-xl font-medium text-muted-foreground">
            {album.artist}
          </p>
        )
      )}

      {details && <p className="text-xs text-muted-foreground">{details}</p>}
    </DetailHeader>
  )
}
