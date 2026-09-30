import { TableFallback } from '@/app/components/fallbacks/table-fallbacks'
import { ShadowHeaderFallback } from '@/app/components/fallbacks/ui-fallbacks'
import ListWrapper from '@/app/components/list-wrapper'
import { MainGrid } from '@/app/components/main-grid'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function AlbumHeaderFallback({
  isArtist = false,
}: {
  isArtist?: boolean
} = {}) {
  if (isArtist) {
    return (
      <div className="w-full px-8 py-6 bg-muted-foreground flex items-center gap-4 bg-gradient-to-b from-background/50 to-background/50">
        <Skeleton className="size-[160px] min-w-[160px] 2xl:size-[200px] 2xl:min-w-[200px] rounded-full shadow-lg" />
        <div className="flex flex-col">
          <Skeleton className="h-9 w-[220px] mb-3" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-8 py-6 bg-muted-foreground flex gap-4 bg-gradient-to-b from-background/50 to-background/50">
      <Skeleton
        className={cn(
          'shadow-lg aspect-square',
          'w-[200px] h-[200px] min-w-[200px] min-h-[200px] 2xl:w-[250px] 2xl:h-[250px] 2xl:min-w-[250px] 2xl:min-h-[250px] rounded',
        )}
      />
      <div className="flex flex-col justify-end">
        <Skeleton className="h-[20px] w-16 mb-4" />
        <Skeleton className="h-12 w-[260px] mb-4" />
        <Skeleton className="h-5 w-[340px] mb-1" />

        <div className="flex gap-2 mt-2">
          <Skeleton className="h-[22px] w-12 rounded-full" />
          <Skeleton className="h-[22px] w-12 rounded-full" />
          <Skeleton className="h-[22px] w-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function PlayButtonsFallback() {
  return (
    <div className="mb-6 flex gap-1 items-center">
      <Skeleton className="rounded-full w-14 h-14 mr-2" />
      <div className="flex items-center justify-center w-14 h-14">
        <Skeleton className="rounded-full w-7 h-7" />
      </div>
      <div className="flex items-center justify-center w-14 h-14">
        <Skeleton className="rounded-full w-7 h-7" />
      </div>
    </div>
  )
}

export function AlbumFallback() {
  return (
    <div className="w-full">
      <div className="flex gap-6 px-8 pt-6 pb-2">
        <Skeleton className="size-[160px] min-w-[160px] 2xl:size-[200px] 2xl:min-w-[200px] rounded-xl" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-9 w-[260px]" />
          <Skeleton className="h-6 w-[180px]" />
          <Skeleton className="h-3 w-24" />
          <div className="mt-auto pt-3 flex gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
      </div>
      <ListWrapper>
        <TableFallback variant="modern" />
      </ListWrapper>
    </div>
  )
}

export function AlbumsFallback() {
  return (
    <div className="w-full">
      <ShadowHeaderFallback />

      <ListWrapper className="flex flex-col gap-4">
        <GridFallback />
      </ListWrapper>
    </div>
  )
}

function GridFallback() {
  return (
    <MainGrid>
      {Array.from({ length: 40 }).map((_, index) => (
        <div key={'card-fallback-' + index}>
          <Skeleton className="aspect-square" />
          <Skeleton className="h-[13px] w-11/12 mt-2" />
          <Skeleton className="h-3 w-1/2 mt-[7px]" />
        </div>
      ))}
    </MainGrid>
  )
}
