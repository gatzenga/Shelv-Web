import InfoPanel from '@/app/components/info/info-panel'
import { useGetAlbumInfo } from '@/app/hooks/use-album'
import { SingleAlbum } from '@/types/responses/album'
import { AlbumButtons } from './buttons'

interface AlbumInfoProps {
  album: SingleAlbum
}

// The buttons on top of the page
export function AlbumInfo({ album }: AlbumInfoProps) {
  return <AlbumButtons album={album} />
}

// The description, shown at the end of the page
export function AlbumNotes({ album }: AlbumInfoProps) {
  const { data: albumInfo } = useGetAlbumInfo(album.id)

  if (!albumInfo?.notes) return null

  return (
    <div className="mt-8 mb-6">
      <InfoPanel
        title={album.name}
        bio={albumInfo.notes}
        lastFmUrl={albumInfo.lastFmUrl}
      />
    </div>
  )
}
