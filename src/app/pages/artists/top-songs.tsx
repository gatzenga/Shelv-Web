import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { TopSongRow } from '@/app/components/artist/top-song-row'
import { SongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { HeaderTitle } from '@/app/components/header-title'
import { LibraryPage } from '@/app/components/library/page'
import ListWrapper from '@/app/components/list-wrapper'
import { useGetArtist, useGetTopSongs } from '@/app/hooks/use-artist'
import ErrorPage from '@/app/pages/error-page'
import { ROUTES } from '@/routes/routesList'
import { usePlayerActions } from '@/store/player.store'
import { topSongsPageSize } from '@/utils/listSizes'

// All the top songs of an artist, in the order of the artist page
export default function ArtistTopSongsPage() {
  const { t } = useTranslation()
  const { artistId } = useParams() as { artistId: string }
  const { setSongList } = usePlayerActions()
  const { data: artist, isLoading, isFetched } = useGetArtist(artistId)
  const { data: topSongs, isLoading: songsLoading } = useGetTopSongs(artist)

  if (isLoading || songsLoading) return <SongListFallback />
  if (isFetched && !artist) {
    return <ErrorPage status={404} statusText="Not Found" />
  }
  if (!artist) return <SongListFallback />

  const songs = (topSongs ?? []).slice(0, topSongsPageSize)

  return (
    <LibraryPage
      header={
        <ShadowHeader fixed={false} showGlassEffect={false}>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.ARTIST.PAGE(artist.id)}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={artist.name}
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <HeaderTitle
              title={t('artist.topSongsOf', { artist: artist.name })}
            />
          </div>
        </ShadowHeader>
      }
    >
      <ListWrapper>
        <div
          className="flex flex-col gap-1 pb-6"
          data-testid="artist-top-songs"
        >
          {songs.map((song, index) => (
            <TopSongRow
              key={song.id}
              song={song}
              index={index}
              onPlay={() => setSongList(songs, index)}
            />
          ))}
        </div>
      </ListWrapper>
    </LibraryPage>
  )
}
