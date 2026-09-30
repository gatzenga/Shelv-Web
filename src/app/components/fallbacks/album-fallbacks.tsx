import { TableFallback } from '@/app/components/fallbacks/table-fallbacks'
import { ShadowHeaderFallback } from '@/app/components/fallbacks/ui-fallbacks'
import ListWrapper from '@/app/components/list-wrapper'
import { MainGrid } from '@/app/components/main-grid'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/lib/utils'

// The top of an album, artist, playlist or genre while it loads
export function DetailHeaderFallback({ round = false }: { round?: boolean }) {
  return (
    <div>
      <div className="flex gap-7 px-8 pt-10 pb-8">
        <Skeleton
          className={cn(
            'size-[160px] min-w-[160px] 2xl:size-[200px] 2xl:min-w-[200px]',
            round ? 'rounded-full' : 'rounded-xl',
          )}
        />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-9 w-[260px]" />
          <Skeleton className="h-6 w-[180px]" />
          <Skeleton className="h-3 w-24" />
          <div className="mt-auto pt-4 flex gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-8 border-b" />
    </div>
  )
}

export function AlbumFallback() {
  return (
    <div className="w-full">
      <DetailHeaderFallback />
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
