import clsx from 'clsx'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { ImageHeaderEffect } from '@/app/components/album/header-effect'
import { AlbumHeaderFallback } from '@/app/components/fallbacks/album-fallbacks'
import { BadgesData, HeaderInfoGenerator } from '@/app/components/header-info'
import { ImageLoader } from '@/app/components/image-loader'
import { useAlbumColor } from '@/app/hooks/use-album-color'
import { cn } from '@/lib/utils'
import { CoverArt } from '@/types/coverArtType'
import { getTextSizeClass } from '@/utils/getTextSizeClass'

// Where the fade below the header starts, the artist header is shorter
const artistEffectTop = 'top-[calc(3rem+184px)] 2xl:top-[calc(3rem+216px)]'

interface ImageHeaderProps {
  type: string
  title: string
  subtitle?: string
  coverArtId?: string
  coverArtType: CoverArt
  coverArtSize: string
  coverArtAlt: string
  badges: BadgesData
  isPlaylist?: boolean
}

export default function ImageHeader({
  type,
  title,
  subtitle,
  coverArtId,
  coverArtType,
  coverArtSize,
  coverArtAlt,
  badges,
  isPlaylist = false,
}: ImageHeaderProps) {
  const { bgColor, handleLoadImage, handleError } =
    useAlbumColor('cover-art-image')

  const isArtist = coverArtType === 'artist'

  return (
    <ImageLoader id={coverArtId} type={coverArtType} size={coverArtSize}>
      {(src, isLoading) => (
        <div
          id="image-header-container"
          className={cn(
            'flex relative w-full',
            isArtist
              ? 'h-[calc(3rem+184px)] 2xl:h-[calc(3rem+216px)]'
              : 'h-[calc(3rem+200px)] 2xl:h-[calc(3rem+250px)]',
          )}
          key={`header-${coverArtId}`}
        >
          {isLoading && (
            <div className="absolute inset-0 z-20">
              <AlbumHeaderFallback isArtist={isArtist} />
            </div>
          )}
          <div
            className={cn(
              'w-full px-8 py-6 flex gap-4 absolute inset-0',
              'bg-gradient-to-b from-background/20 to-background/50',
              isArtist && 'items-center',
            )}
            style={{ backgroundColor: bgColor }}
          >
            <div
              className={cn(
                isArtist
                  ? 'w-[184px] h-[184px] min-w-[184px] min-h-[184px] 2xl:w-[216px] 2xl:h-[216px] 2xl:min-w-[216px] 2xl:min-h-[216px]'
                  : 'w-[200px] h-[200px] min-w-[200px] min-h-[200px] 2xl:w-[250px] 2xl:h-[250px] 2xl:min-w-[250px] 2xl:min-h-[250px]',
                'bg-skeleton aspect-square bg-cover bg-center',
                isArtist ? 'rounded-full' : 'rounded',
                'shadow-header-image overflow-hidden relative',
              )}
            >
              <LazyLoadImage
                key={coverArtId}
                effect="opacity"
                crossOrigin="anonymous"
                id="cover-art-image"
                src={src}
                alt={coverArtAlt}
                className={cn(
                  'aspect-square object-cover w-full h-full',
                  isArtist && 'rounded-full',
                )}
                width="100%"
                height="100%"
                onLoad={handleLoadImage}
                onError={handleError}
              />
            </div>

            <div
              className={cn(
                'flex w-full flex-col z-10',
                isArtist
                  ? 'max-w-[calc(100%-200px)] 2xl:max-w-[calc(100%-232px)] justify-center'
                  : 'max-w-[calc(100%-216px)] 2xl:max-w-[calc(100%-266px)] justify-end',
              )}
            >
              {!isArtist && (
                <p className="text-xs 2xl:text-sm font-medium text-shadow-md">
                  {type}
                </p>
              )}
              <h1
                className={clsx(
                  'max-w-full scroll-m-20 font-bold tracking-tight antialiased text-shadow-md break-words line-clamp-2',
                  getTextSizeClass(title),
                )}
              >
                {title}
              </h1>

              {isPlaylist && subtitle && (
                <>
                  <p className="text-sm opacity-80 text-shadow-md line-clamp-2 mt-1 mb-2">
                    {subtitle}
                  </p>
                  <HeaderInfoGenerator badges={badges} showFirstDot={false} />
                </>
              )}

              {!subtitle && (
                <div className="mt-1">
                  <HeaderInfoGenerator badges={badges} showFirstDot={false} />
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <ImageHeaderEffect
              className={cn('bg-muted-foreground', isArtist && artistEffectTop)}
            />
          ) : (
            <ImageHeaderEffect
              className={isArtist ? artistEffectTop : undefined}
              style={{ backgroundColor: bgColor }}
            />
          )}
        </div>
      )}
    </ImageLoader>
  )
}
