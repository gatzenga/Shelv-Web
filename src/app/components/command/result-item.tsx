import Image from '@/app/components/image'
import { ImageLoader } from '@/app/components/image-loader'
import { cn } from '@/lib/utils'
import { CoverArt } from '@/types/coverArtType'

interface ResultItemProps {
  coverArt: string
  coverArtType: CoverArt
  title: string
  artist: string
  isPlaying?: boolean
}

export function ResultItem({
  coverArt,
  coverArtType,
  title,
  artist,
  isPlaying = false,
}: ResultItemProps) {
  return (
    <div className="flex w-full items-center gap-3 py-0.5">
      <div className="shrink-0">
        <ImageLoader id={coverArt} type={coverArtType} size={100}>
          {(src) => (
            <Image
              src={src}
              width={40}
              height={40}
              className={cn(
                'aspect-square object-cover shadow',
                coverArtType === 'artist' ? 'rounded-full' : 'rounded',
              )}
              alt={`${artist} - ${title}`}
            />
          )}
        </ImageLoader>
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <span
          className={cn(
            'font-medium text-sm truncate',
            isPlaying && 'text-primary',
          )}
        >
          {title}
        </span>
        <span className="text-xs text-muted-foreground truncate">{artist}</span>
      </div>
    </div>
  )
}
