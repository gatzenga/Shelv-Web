import { ArrowUpRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGetArtistInfo } from '@/app/hooks/use-artist'
import { Albums } from '@/types/responses/album'
import { IArtist } from '@/types/responses/artist'
import { ISong } from '@/types/responses/song'
import { sanitizeLinks } from '@/utils/parseTexts'
import { ArtistButtons } from './buttons'

interface ArtistInfoProps {
  artist: IArtist
  topSongs?: ISong[]
  sortedAlbums?: Albums[]
}

// The buttons on top of the page
export function ArtistInfo({
  artist,
  topSongs,
  sortedAlbums,
}: ArtistInfoProps) {
  const isArtistEmpty =
    artist.albumCount === undefined || artist.albumCount === 0

  return (
    <ArtistButtons
      artist={artist}
      isArtistEmpty={isArtistEmpty}
      topSongs={topSongs}
      sortedAlbums={sortedAlbums}
    />
  )
}

const linkClasses =
  'inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/15'

interface ArtistLinkProps {
  href: string
  children: string
}

function ArtistLink({ href, children }: ArtistLinkProps) {
  return (
    <a
      target="_blank"
      rel="nofollow noreferrer"
      href={href}
      className={linkClasses}
    >
      <ArrowUpRightIcon className="w-3.5 h-3.5" />
      {children}
    </a>
  )
}

// The biography and the external links, shown at the end of the page
export function ArtistBiography({ artist }: ArtistInfoProps) {
  const { t } = useTranslation()
  const { data: artistInfo } = useGetArtistInfo(artist.id)

  if (!artistInfo?.biography) return null

  const { lastFmUrl, musicBrainzId } = artistInfo

  return (
    <div className="mt-8 mb-6" id="artist-biography">
      <h3 className="scroll-m-20 mb-3 text-2xl font-semibold tracking-tight">
        {t('artist.moreInfo')}
      </h3>
      <div className="max-w-3xl rounded-lg border p-5 text-sm bg-background-foreground">
        <p
          className="html leading-6 text-muted-foreground"
          dangerouslySetInnerHTML={{
            __html: sanitizeLinks(artistInfo.biography),
          }}
        />
      </div>

      {(lastFmUrl || musicBrainzId) && (
        <div className="flex flex-wrap gap-2.5 mt-3">
          {lastFmUrl && <ArtistLink href={lastFmUrl}>Last.fm</ArtistLink>}
          {musicBrainzId && (
            <ArtistLink
              href={`https://musicbrainz.org/artist/${musicBrainzId}`}
            >
              MusicBrainz
            </ArtistLink>
          )}
        </div>
      )}
    </div>
  )
}
