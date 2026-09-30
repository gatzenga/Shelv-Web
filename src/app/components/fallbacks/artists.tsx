import { SongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { ShadowHeaderFallback } from '@/app/components/fallbacks/ui-fallbacks'
import ListWrapper from '@/app/components/list-wrapper'
import { MainGrid } from '@/app/components/main-grid'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useAppArtistsViewType } from '@/store/app.store'

export function ArtistsFallback() {
  const { isTableView } = useAppArtistsViewType()

  if (isTableView) return <SongListFallback />

  return (
    <div className="w-full">
      <ShadowHeaderFallback />

      <ListWrapper className="flex flex-col gap-4">
        <MainGrid>
          {Array.from({ length: 40 }).map((_, index) => (
            <div
              key={`artist-fallback-${index}`}
              className="flex flex-col gap-2 min-w-0"
            >
              <Skeleton className="rounded-full aspect-square w-full" />
              <div className="flex flex-col gap-1 w-full">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </MainGrid>
      </ListWrapper>
    </div>
  )
}
