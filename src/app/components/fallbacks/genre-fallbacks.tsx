import { DetailHeaderFallback } from '@/app/components/fallbacks/album-fallbacks'
import { SongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import ListWrapper from '@/app/components/list-wrapper'
import { MainGrid } from '@/app/components/main-grid'
import { Skeleton } from '@/app/components/ui/skeleton'

export function GenresFallback() {
  return <SongListFallback />
}

export function GenreFallback() {
  return (
    <div className="w-full">
      <DetailHeaderFallback />
      <ListWrapper className="px-8 pt-6">
        <MainGrid>
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={'genre-card-fallback-' + index}>
              <Skeleton className="aspect-square" />
              <Skeleton className="h-[13px] w-11/12 mt-2" />
              <Skeleton className="h-3 w-1/2 mt-[7px]" />
            </div>
          ))}
        </MainGrid>
      </ListWrapper>
    </div>
  )
}
