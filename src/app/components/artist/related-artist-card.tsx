import clsx from 'clsx'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { PreviewCard } from '@/app/components/preview-card/card'
import { ArtistCardContextMenu } from '@/app/components/preview-card/card-menu'
import { ROUTES } from '@/routes/routesList'
import { useIsArtistPlaying } from '@/store/player.store'
import { ISimilarArtist } from '@/types/responses/artist'

interface RelatedArtistCardProps {
  artist: ISimilarArtist
}

export function RelatedArtistCard({ artist }: RelatedArtistCardProps) {
  const { isArtistPlaying } = useIsArtistPlaying(artist.id)

  return (
    <ArtistCardContextMenu id={artist.id} name={artist.name}>
      <PreviewCard.Root>
        <PreviewCard.ImageWrapper
          className="rounded-full"
          link={ROUTES.ARTIST.PAGE(artist.id)}
        >
          <ImageLoader id={artist.coverArt} type="artist">
            {(src) => <PreviewCard.Image src={src} alt={artist.name} />}
          </ImageLoader>
        </PreviewCard.ImageWrapper>
        <PreviewCard.InfoWrapper>
          <div className="flex items-center gap-1">
            {isArtistPlaying && (
              <EqualizerBars size={14} className="text-primary" />
            )}
            <PreviewCard.Subtitle
              link={ROUTES.ARTIST.PAGE(artist.id)}
              className={clsx('mt-2', isArtistPlaying && 'text-primary')}
            >
              {artist.name}
            </PreviewCard.Subtitle>
          </div>
        </PreviewCard.InfoWrapper>
      </PreviewCard.Root>
    </ArtistCardContextMenu>
  )
}
