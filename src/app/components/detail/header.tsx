import { ReactNode } from 'react'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { ImageLoader } from '@/app/components/image-loader'
import { cn } from '@/lib/utils'
import { CoverArt } from '@/types/coverArtType'

interface DetailHeaderProps {
  coverArtId?: string
  coverArtType: CoverArt
  title: string
  // a round cover, for artists
  round?: boolean
  // the lines below the title
  children?: ReactNode
  // the action buttons, below the lines
  actions?: ReactNode
}

// The top of an album, artist, playlist or genre like in the Shelv app: the
// cover, and right of it the title, some lines and the action buttons
export function DetailHeader({
  coverArtId,
  coverArtType,
  title,
  round = false,
  children,
  actions,
}: DetailHeaderProps) {
  return (
    <div data-testid="detail-header">
      <div className="flex gap-7 px-8 pt-10 pb-8">
        <div
          className={cn(
            'size-[160px] min-w-[160px] 2xl:size-[200px] 2xl:min-w-[200px] overflow-hidden bg-skeleton shadow-header-image',
            round ? 'rounded-full' : 'rounded-xl',
          )}
        >
          <ImageLoader id={coverArtId} type={coverArtType} size="700">
            {(src) => (
              <LazyLoadImage
                key={coverArtId}
                effect="opacity"
                src={src}
                alt={title}
                className="aspect-square object-cover w-full h-full"
                width="100%"
                height="100%"
              />
            )}
          </ImageLoader>
        </div>

        <div className="flex flex-1 min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight break-words line-clamp-2">
            {title}
          </h1>

          {children}

          {actions && (
            <div className="mt-auto pt-4 [&>div]:mb-0">{actions}</div>
          )}
        </div>
      </div>

      <div className="mx-8 border-b" />
    </div>
  )
}
