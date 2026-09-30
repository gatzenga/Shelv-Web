import { Play } from 'lucide-react'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { Link } from 'react-router-dom'
import { ImageLoader } from '@/app/components/image-loader'
import { cn } from '@/lib/utils'
import { CoverArt } from '@/types/coverArtType'

interface RankRowProps {
  rank: number
  title: string
  subtitle?: string
  playCount?: number
  coverArtId?: string
  coverArtType: CoverArt
  to?: string
  onClick?: () => void
  onNavigate?: () => void
}

export function RankRow({
  rank,
  title,
  subtitle,
  playCount,
  coverArtId,
  coverArtType,
  to,
  onClick,
  onNavigate,
}: RankRowProps) {
  const isTop3 = rank <= 3

  const content = (
    <>
      <span
        className={cn(
          'w-7 shrink-0 text-right tabular-nums font-bold',
          isTop3 ? 'text-xl text-primary' : 'text-sm text-muted-foreground',
        )}
      >
        {rank}
      </span>

      <div
        className={cn(
          'size-[52px] shrink-0 overflow-hidden bg-skeleton',
          coverArtType === 'artist' ? 'rounded-full' : 'rounded-lg',
        )}
      >
        <ImageLoader id={coverArtId} type={coverArtType} size="100">
          {(src) => (
            <LazyLoadImage
              src={src}
              alt={title}
              effect="opacity"
              width={52}
              height={52}
              className="size-full object-cover"
            />
          )}
        </ImageLoader>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', isTop3 ? 'font-bold' : 'font-medium')}>
          {title}
        </span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>

      {playCount !== undefined && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs tabular-nums',
            isTop3
              ? 'bg-primary/15 text-primary'
              : 'bg-muted-foreground/10 text-muted-foreground',
          )}
        >
          <Play className="size-2.5 fill-current" />
          {playCount}
        </span>
      )}
    </>
  )

  const className = cn(
    'flex w-full items-center gap-3 rounded-[14px] px-3.5 text-left transition-colors',
    isTop3
      ? 'border border-primary/25 bg-primary/10 py-2.5 hover:bg-primary/15'
      : 'bg-muted/40 py-1.5 hover:bg-muted/70',
  )

  if (to) {
    return (
      <Link to={to} className={className} onClick={onNavigate}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}
