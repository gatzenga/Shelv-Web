import { useTranslation } from 'react-i18next'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { Link } from 'react-router-dom'
import { ImageLoader } from '@/app/components/image-loader'
import { AlbumCardContextMenu } from '@/app/components/preview-card/card-menu'
import { ROUTES } from '@/routes/routesList'
import { Albums } from '@/types/responses/album'

interface LatestReleaseCardProps {
  album: Albums
}

// The artist's newest release, offered first in the discography
export function LatestReleaseCard({ album }: LatestReleaseCardProps) {
  const { t } = useTranslation()

  return (
    <AlbumCardContextMenu albumId={album.id}>
      <Link
        to={ROUTES.ALBUM.PAGE(album.id)}
        className="flex items-center gap-4 w-full max-w-[520px] rounded-xl border bg-background-foreground p-3 transition-colors hover:bg-accent/50"
        data-testid="artist-latest-release"
      >
        <div className="w-[88px] h-[88px] min-w-[88px] rounded-lg overflow-hidden bg-skeleton shadow-sm">
          <ImageLoader id={album.coverArt} type="album" size="300">
            {(src) => (
              <LazyLoadImage
                src={src}
                alt={album.name}
                effect="opacity"
                width={88}
                height={88}
                className="w-full h-full object-cover"
              />
            )}
          </ImageLoader>
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-bold text-primary">
            {t('artist.latestRelease')}
          </span>
          <span className="font-semibold leading-tight line-clamp-2">
            {album.name}
          </span>
          {album.year ? (
            <span className="text-sm text-muted-foreground">{album.year}</span>
          ) : null}
        </div>
      </Link>
    </AlbumCardContextMenu>
  )
}
