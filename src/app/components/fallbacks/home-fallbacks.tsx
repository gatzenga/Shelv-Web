import { Skeleton } from '@/app/components/ui/skeleton'

export function HomeFallback() {
  return (
    <div className="w-full px-8 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[52px] rounded-full" />
        ))}
      </div>

      <PreviewListFallback />
      <PreviewListFallback />
      <PreviewListFallback />
      <PreviewListFallback />
    </div>
  )
}

export function PreviewListFallback({
  cardWidth = 210,
}: {
  cardWidth?: number
}) {
  return (
    <div className="w-full flex flex-col my-4">
      <div className="flex justify-between my-4">
        <Skeleton className="w-52 h-8 rounded" />
        <div className="flex gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>

      <SongsCarouselFallback cardWidth={cardWidth} />
    </div>
  )
}

export function SongsCarouselFallback({
  cardWidth = 210,
}: {
  cardWidth?: number
}) {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            style={{ width: `${cardWidth}px` }}
            className="shrink-0"
            key={index}
          >
            <Skeleton className="aspect-square" />
            <Skeleton className="h-[13px] w-11/12 mt-2" />
            <Skeleton className="h-3 w-1/2 mt-[7px]" />
          </div>
        ))}
      </div>
    </div>
  )
}
