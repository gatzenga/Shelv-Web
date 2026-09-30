import { DetailHeaderFallback } from '@/app/components/fallbacks/album-fallbacks'
import { TableFallback } from '@/app/components/fallbacks/table-fallbacks'
import ListWrapper from '@/app/components/list-wrapper'

export function PlaylistFallback() {
  return (
    <div className="w-full">
      <DetailHeaderFallback />

      <ListWrapper>
        <TableFallback variant="modern" />
      </ListWrapper>
    </div>
  )
}
