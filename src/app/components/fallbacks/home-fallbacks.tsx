import { Skeleton } from '@/app/components/ui/skeleton'

export function HeaderFallback() {
  return (
    <div className="flex w-full bg-skeleton h-[180px] 2xl:h-[210px] p-5 gap-5 rounded-lg">
      <Skeleton className="bg-background/50 h-full aspect-square rounded-md" />
      <div className="flex flex-col gap-3 w-full h-full justify-end">
        <Skeleton className="w-72 h-7 bg-background/50" />
        <Skeleton className="w-48 h-5 bg-background/50" />

        <div className="flex gap-2">
          <Skeleton className="w-16 h-6 bg-background/50 rounded-full" />
          <Skeleton className="w-16 h-6 bg-background/50 rounded-full" />
          <Skeleton className="w-16 h-6 bg-background/50 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 h-full items-end">
        <Skeleton className="w-8 h-8 bg-background/50 rounded-full" />
        <Skeleton className="w-8 h-8 bg-background/50 rounded-full" />
      </div>
    </div>
  )
}

export function HomeFallback() {
  return (
    <div className="w-full">
      <HeaderFallback />

      <div className="px-8 pb-6">
        <PreviewListFallback />
        <PreviewListFallback />
        <PreviewListFallback />
        <PreviewListFallback />
      </div>
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
