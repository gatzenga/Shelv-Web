import clsx from 'clsx'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { PreviewCard } from '@/app/components/preview-card/card'
import { ArtistCardMenu } from '@/app/components/preview-card/card-menu'
import { useSongList } from '@/app/hooks/use-song-list'
import { ROUTES } from '@/routes/routesList'
import { useIsArtistPlaying, usePlayerActions } from '@/store/player.store'
import { ISimilarArtist } from '@/types/responses/artist'

type ArtistCardProps = {
  artist: ISimilarArtist
}

function ArtistCard({ artist }: ArtistCardProps) {
  const { t } = useTranslation()
  const { getArtistAllSongs } = useSongList()
  const { setSongList, togglePlayPause } = usePlayerActions()
  const { isArtistActive, isArtistPlaying } = useIsArtistPlaying(artist.id)

  async function playArtistRadio() {
    const songList = await getArtistAllSongs(artist.name)

    if (!songList) return

    setSongList(songList, 0, false, {
      id: artist.id,
      name: artist.name,
      type: 'artist',
    })
  }

  function handlePlayButton() {
    if (isArtistActive) {
      togglePlayPause()
    } else {
      playArtistRadio()
    }
  }

  return (
    <PreviewCard.Root className="flex flex-col w-full h-full">
      <PreviewCard.ImageWrapper
        className="rounded-full"
        link={ROUTES.ARTIST.PAGE(artist.id)}
      >
        <ImageLoader id={artist.coverArt} type="artist" size={300}>
          {(src) => <PreviewCard.Image src={src} alt={artist.name} />}
        </ImageLoader>
        {isArtistPlaying ? (
          <PreviewCard.PauseButton onClick={handlePlayButton} />
        ) : (
          <PreviewCard.PlayButton onClick={handlePlayButton} />
        )}
      </PreviewCard.ImageWrapper>
      <div className="flex items-start gap-1">
        <PreviewCard.InfoWrapper>
          <div className="flex items-center gap-1">
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
        <div className="ml-auto mt-0.5">
          <ArtistCardMenu id={artist.id} name={artist.name} />
        </div>
      </div>
    </PreviewCard.Root>
  )
}

export const ArtistGridCard = memo(ArtistCard)
