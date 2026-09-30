import { SingleAlbum } from '@/types/responses/album'
import { AlbumButtons } from './buttons'

interface AlbumInfoProps {
  album: SingleAlbum
}

// The buttons on top of the page. Only artists have a description.
export function AlbumInfo({ album }: AlbumInfoProps) {
  return <AlbumButtons album={album} />
}
