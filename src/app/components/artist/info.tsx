import { CollapsibleInfo } from '@/app/components/info/collapsible-info'
import { useGetArtistInfo } from '@/app/hooks/use-artist'
import { IArtist } from '@/types/responses/artist'
import { ArtistButtons } from './buttons'

interface ArtistInfoProps {
  artist: IArtist
}

function isEmptyArtist(artist: IArtist) {
  return artist.albumCount === undefined || artist.albumCount === 0
}

// The buttons on top of the page, the info button opens the biography
export function ArtistInfo({ artist }: ArtistInfoProps) {
  const { data: artistInfo } = useGetArtistInfo(artist.id)

  const hasInfoToShow =
    artistInfo !== undefined && artistInfo.biography !== undefined

  return (
    <ArtistButtons
      artist={artist}
      showInfoButton={hasInfoToShow}
      isArtistEmpty={isEmptyArtist(artist)}
    />
  )
}

// The biography, shown at the end of the page
export function ArtistBiography({ artist }: ArtistInfoProps) {
  const { data: artistInfo } = useGetArtistInfo(artist.id)

  if (artistInfo === undefined || artistInfo.biography === undefined) {
    return null
  }

  return (
    <div className="mt-8">
      <CollapsibleInfo
        title={artist.name}
        bio={artistInfo.biography}
        lastFmUrl={artistInfo.lastFmUrl}
        musicBrainzId={artistInfo.musicBrainzId}
        useStateInfo={!isEmptyArtist(artist)}
      />
    </div>
  )
}
