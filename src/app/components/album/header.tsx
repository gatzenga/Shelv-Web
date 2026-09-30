import { ReactNode } from 'react'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { Link } from 'react-router-dom'
import { ImageLoader } from '@/app/components/image-loader'
import { ROUTES } from '@/routes/routesList'
import { SingleAlbum } from '@/types/responses/album'

interface AlbumHeaderProps {
  album: SingleAlbum
  // The action buttons, below the texts
  children: ReactNode
}

// The top of an album like in the Shelv app: the cover, and right of it the
// title, the artist in the accent color and the year
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
    <div data-testid="album-header">
      <div className="flex gap-7 px-8 pt-10 pb-8">
        <div className="size-[160px] min-w-[160px] 2xl:size-[200px] 2xl:min-w-[200px] rounded-xl overflow-hidden bg-skeleton shadow-header-image">
          <ImageLoader id={album.coverArt} type="album" size="700">
            {(src) => (
              <LazyLoadImage
                key={album.coverArt}
                effect="opacity"
                src={src}
                alt={album.name}
                className="aspect-square object-cover w-full h-full"
                width="100%"
                height="100%"
              />
            )}
          </ImageLoader>
        </div>

        <div className="flex flex-1 min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight break-words line-clamp-2">
            {album.name}
          </h1>

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

          {details && (
            <p className="text-xs text-muted-foreground">{details}</p>
          )}

          <div className="mt-auto pt-4 [&>div]:mb-0">{children}</div>
        </div>
      </div>

      <div className="mx-8 border-b" />
    </div>
  )
}
