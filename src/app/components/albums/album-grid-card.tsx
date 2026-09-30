import clsx from 'clsx'
import { memo } from 'react'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { PreviewCard } from '@/app/components/preview-card/card'
import { AlbumCardContextMenu } from '@/app/components/preview-card/card-menu'
import { ROUTES } from '@/routes/routesList'
import { useIsAlbumPlaying } from '@/store/player.store'
import { Albums } from '@/types/responses/album'

type AlbumCardProps = {
  album: Albums
  subtitleType?: 'artist' | 'year'
}

function AlbumCard({ album, subtitleType = 'artist' }: AlbumCardProps) {
  const { isAlbumPlaying } = useIsAlbumPlaying(album.id)

  return (
    <AlbumCardContextMenu albumId={album.id}>
      <PreviewCard.Root>
        <PreviewCard.ImageWrapper link={ROUTES.ALBUM.PAGE(album.id)}>
          <ImageLoader id={album.coverArt} type="album" size={300}>
            {(src) => <PreviewCard.Image src={src} alt={album.name} />}
          </ImageLoader>
        </PreviewCard.ImageWrapper>
        <div className="mt-1.5">
          <PreviewCard.InfoWrapper>
            <div className="flex items-center gap-1">
              {isAlbumPlaying && (
                <EqualizerBars size={14} className="mb-0.5 text-primary" />
              )}
              <PreviewCard.Title
                link={ROUTES.ALBUM.PAGE(album.id)}
                className={clsx(
                  'text-xs leading-5',
                  isAlbumPlaying && 'text-primary',
                )}
              >
                {album.name}
              </PreviewCard.Title>
            </div>
            <PreviewCard.Subtitle
              className="text-[11px] leading-4"
              enableLink={
                subtitleType === 'year' ? false : album.artistId !== undefined
              }
              link={
                subtitleType === 'year'
                  ? undefined
                  : ROUTES.ARTIST.PAGE(album.artistId ?? '')
              }
            >
              {subtitleType === 'year'
                ? album.year
                  ? String(album.year)
                  : ''
                : album.artist}
            </PreviewCard.Subtitle>
            {subtitleType !== 'year' && album.year ? (
              <PreviewCard.Subtitle
                enableLink={false}
                className="text-[11px] text-muted-foreground/70"
              >
                {String(album.year)}
              </PreviewCard.Subtitle>
            ) : null}
          </PreviewCard.InfoWrapper>
        </div>
      </PreviewCard.Root>
    </AlbumCardContextMenu>
  )
}

export const AlbumGridCard = memo(AlbumCard)
