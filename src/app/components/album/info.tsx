import { CollapsibleInfo } from '@/app/components/info/collapsible-info'
import { useGetAlbumInfo } from '@/app/hooks/use-album'
import { SingleAlbum } from '@/types/responses/album'
import { AlbumButtons } from './buttons'

interface AlbumInfoProps {
  album: SingleAlbum
}

// The buttons on top of the page, the info button opens the description
export function AlbumInfo({ album }: AlbumInfoProps) {
  const { data: albumInfo } = useGetAlbumInfo(album.id)

  const hasInfoToShow = albumInfo !== undefined && albumInfo.notes !== undefined

  return <AlbumButtons album={album} showInfoButton={hasInfoToShow} />
}

// The description, shown at the end of the page
export function AlbumNotes({ album }: AlbumInfoProps) {
  const { data: albumInfo } = useGetAlbumInfo(album.id)

  if (albumInfo === undefined || albumInfo.notes === undefined) return null

  return (
    <div className="mt-8">
      <CollapsibleInfo
        title={album.name}
        bio={albumInfo.notes}
        lastFmUrl={albumInfo.lastFmUrl}
      />
    </div>
  )
}
