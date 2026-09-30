import clsx from 'clsx'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { PreviewCard } from '@/app/components/preview-card/card'
import { ArtistCardContextMenu } from '@/app/components/preview-card/card-menu'
import { ROUTES } from '@/routes/routesList'
import { useIsArtistPlaying } from '@/store/player.store'
import { ISimilarArtist } from '@/types/responses/artist'

type ArtistCardProps = {
  artist: ISimilarArtist
}

function ArtistCard({ artist }: ArtistCardProps) {
  const { t } = useTranslation()
  const { isArtistPlaying } = useIsArtistPlaying(artist.id)

  return (
    <ArtistCardContextMenu id={artist.id} name={artist.name}>
      <PreviewCard.Root className="flex flex-col w-full h-full">
        <PreviewCard.ImageWrapper
          className="rounded-full"
          link={ROUTES.ARTIST.PAGE(artist.id)}
        >
          <ImageLoader id={artist.coverArt} type="artist" size={300}>
            {(src) => <PreviewCard.Image src={src} alt={artist.name} />}
          </ImageLoader>
        </PreviewCard.ImageWrapper>
        <div className="text-center">
          <PreviewCard.InfoWrapper>
            <div className="flex items-center justify-center gap-1">
              {isArtistPlaying && (
                <EqualizerBars size={14} className="mb-0.5 text-primary" />
              )}
              <PreviewCard.Title
                link={ROUTES.ARTIST.PAGE(artist.id)}
                className={clsx(isArtistPlaying && 'text-primary')}
              >
                {artist.name}
              </PreviewCard.Title>
            </div>
            <PreviewCard.Subtitle enableLink={false}>
              {t('artist.info.albumsCount', {
                count: artist.albumCount,
              })}
            </PreviewCard.Subtitle>
          </PreviewCard.InfoWrapper>
        </div>
      </PreviewCard.Root>
    </ArtistCardContextMenu>
  )
}

export const ArtistGridCard = memo(ArtistCard)
