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
const artistEffectTop = 'top-[270px] 2xl:top-[310px]'

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
              ? 'h-[270px] 2xl:h-[310px]'
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
              'w-full px-8 py-6 absolute inset-0',
              'bg-gradient-to-b from-background/20 to-background/50',
              isArtist
                ? 'flex flex-col items-center justify-center text-center gap-2.5'
                : 'flex gap-4 items-end',
            )}
            style={{ backgroundColor: bgColor }}
          >
            <div
              className={cn(
                isArtist
                  ? 'size-[140px] min-w-[140px] min-h-[140px] 2xl:size-[170px] 2xl:min-w-[170px] 2xl:min-h-[170px] rounded-full'
                  : 'w-[200px] h-[200px] min-w-[200px] min-h-[200px] 2xl:w-[250px] 2xl:h-[250px] 2xl:min-w-[250px] 2xl:min-h-[250px] rounded',
                'bg-skeleton aspect-square bg-cover bg-center shadow-header-image overflow-hidden relative shrink-0',
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
                  ? 'items-center justify-center text-center'
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
                  isArtist ? 'text-3xl text-center' : getTextSizeClass(title),
                )}
              >
                {title}
              </h1>

              {isArtist ? (
                subtitle && (
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase text-shadow-sm mt-1">
                    {subtitle}
                  </p>
                )
              ) : isPlaylist && subtitle ? (
                <>
                  <p className="text-sm opacity-80 text-shadow-md line-clamp-2 mt-1 mb-2">
                    {subtitle}
                  </p>
                  <HeaderInfoGenerator badges={badges} showFirstDot={false} />
                </>
              ) : (
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
