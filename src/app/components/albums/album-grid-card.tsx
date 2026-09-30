import clsx from 'clsx'
import { memo } from 'react'
import { EqualizerBars } from '@/app/components/icons/equalizer-bars'
import { ImageLoader } from '@/app/components/image-loader'
import { PreviewCard } from '@/app/components/preview-card/card'
import { AlbumCardMenu } from '@/app/components/preview-card/card-menu'
import { ROUTES } from '@/routes/routesList'
import { subsonic } from '@/service/subsonic'
import { useIsAlbumPlaying, usePlayerActions } from '@/store/player.store'
import { Albums } from '@/types/responses/album'

type AlbumCardProps = {
  album: Albums
  subtitleType?: 'artist' | 'year'
}

function AlbumCard({ album, subtitleType = 'artist' }: AlbumCardProps) {
  const { setSongList } = usePlayerActions()
  const { isAlbumPlaying } = useIsAlbumPlaying(album.id)

  async function playCurrentAlbum() {
    const response = await subsonic.albums.getOne(album.id)

    if (response) {
      setSongList(response.song, 0, false, {
        id: response.id,
        name: response.name,
        type: 'album',
      })
    }
  }

  return (
    <PreviewCard.Root>
      <PreviewCard.ImageWrapper link={ROUTES.ALBUM.PAGE(album.id)}>
        <ImageLoader id={album.coverArt} type="album" size={300}>
          {(src) => <PreviewCard.Image src={src} alt={album.name} />}
        </ImageLoader>
        <PreviewCard.PlayButton onClick={playCurrentAlbum} />
      </PreviewCard.ImageWrapper>
      <div className="flex items-start gap-1">
        <PreviewCard.InfoWrapper>
          <div className="flex items-center gap-1">
            {isAlbumPlaying && (
              <EqualizerBars size={14} className="mb-0.5 text-primary" />
            )}
            <PreviewCard.Title
              link={ROUTES.ALBUM.PAGE(album.id)}
              className={clsx(isAlbumPlaying && 'text-primary')}
            >
              {album.name}
            </PreviewCard.Title>
          </div>
          <PreviewCard.Subtitle
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
        </PreviewCard.InfoWrapper>
        <div className="ml-auto mt-0.5">
          <AlbumCardMenu albumId={album.id} />
        </div>
      </div>
    </PreviewCard.Root>
  )
}

export const AlbumGridCard = memo(AlbumCard)
