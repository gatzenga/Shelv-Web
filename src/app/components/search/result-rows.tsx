import { Link } from 'react-router-dom'
import { CoverImage } from '@/app/components/table/cover-image'
import { ROUTES } from '@/routes/routesList'
import { Albums } from '@/types/responses/album'
import { ISimilarArtist } from '@/types/responses/artist'

const rowClass =
  'flex items-center gap-3 h-16 px-3 rounded-lg hover:bg-foreground/10 transition-colors'

interface ArtistRowProps {
  artist: ISimilarArtist
  onOpen: () => void
  albumsLabel?: string
}

export function SearchArtistRow({
  artist,
  onOpen,
  albumsLabel,
}: ArtistRowProps) {
  return (
    <Link
      to={ROUTES.ARTIST.PAGE(artist.id)}
      onClick={onOpen}
      className={rowClass}
      data-testid="search-artist"
    >
      <CoverImage
        coverArt={artist.coverArt}
        coverArtType="artist"
        altText={artist.name}
        size={40}
      />
      <div className="flex flex-col min-w-0">
        <span className="truncate">{artist.name}</span>
        {albumsLabel && (
          <span className="text-xs text-muted-foreground">{albumsLabel}</span>
        )}
      </div>
    </Link>
  )
}

interface AlbumRowProps {
  album: Albums
  onOpen: () => void
}

export function SearchAlbumRow({ album, onOpen }: AlbumRowProps) {
  const details = [album.artist, album.year ? String(album.year) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to={ROUTES.ALBUM.PAGE(album.id)}
      onClick={onOpen}
      className={rowClass}
      data-testid="search-album"
    >
      <CoverImage
        coverArt={album.coverArt}
        coverArtType="album"
        altText={album.name}
        size={40}
      />
      <div className="flex flex-col min-w-0">
        <span className="truncate">{album.name}</span>
        {details && (
          <span className="text-xs text-muted-foreground truncate">
            {details}
          </span>
        )}
      </div>
    </Link>
  )
}
