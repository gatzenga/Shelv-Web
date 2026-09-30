import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import ImageHeader from '@/app/components/album/image-header'
import { ArtistAlbumShelf } from '@/app/components/artist/album-shelf'
import {
  AlbumSortControls,
  getLatestRelease,
  useAlbumSort,
} from '@/app/components/artist/album-sort'
import ArtistTopSongs from '@/app/components/artist/artist-top-songs'
import { ArtistBiography, ArtistInfo } from '@/app/components/artist/info'
import { LatestReleaseCard } from '@/app/components/artist/latest-release-card'
import RelatedArtistsList from '@/app/components/artist/related-artists'
import { ArtistStickyHeader } from '@/app/components/artist/sticky-header'
import { AlbumFallback } from '@/app/components/fallbacks/album-fallbacks'
import { PreviewListFallback } from '@/app/components/fallbacks/home-fallbacks'
import { TopSongsTableFallback } from '@/app/components/fallbacks/table-fallbacks'
import { BadgesData } from '@/app/components/header-info'
import ListWrapper from '@/app/components/list-wrapper'
import {
  useGetArtist,
  useGetArtistInfo,
  useGetTopSongs,
} from '@/app/hooks/use-artist'
import ErrorPage from '@/app/pages/error-page'
import { ROUTES } from '@/routes/routesList'
import { subsonic } from '@/service/subsonic'
import { queryKeys } from '@/utils/queryKeys'

export default function Artist() {
  const { t } = useTranslation()
  const { artistId } = useParams() as { artistId: string }

  const {
    data: artist,
    isLoading: artistIsLoading,
    isFetched,
  } = useGetArtist(artistId)
  const { data: artistInfo, isLoading: artistInfoIsLoading } =
    useGetArtistInfo(artistId)
  const { data: topSongs, isLoading: topSongsIsLoading } =
    useGetTopSongs(artist)
  const { data: allArtists } = useQuery({
    queryKey: [queryKeys.artist.all],
    queryFn: subsonic.artists.getAll,
  })

  const albumSort = useAlbumSort(artist?.album)
  const latestRelease = useMemo(
    () => getLatestRelease(artist?.album ?? []),
    [artist?.album],
  )

  const albumArtistIds = useMemo(() => {
    if (!allArtists) return null
    return new Set(allArtists.map((a) => a.id))
  }, [allArtists])

  const similarArtists = useMemo(() => {
    if (!artistInfo?.similarArtist) return []
    return artistInfo.similarArtist.filter((similar) => {
      // Must be present in the user's library
      if (!similar.id || similar.id === '-1') return false
      // Must have albums (Navidrome getArtistInfo2 returns albumCount)
      if (similar.albumCount !== undefined && similar.albumCount <= 0)
        return false
      // Only keep verified album artists from the library
      if (albumArtistIds && !albumArtistIds.has(similar.id)) return false
      return true
    })
  }, [artistInfo?.similarArtist, albumArtistIds])

  if (artistIsLoading) return <AlbumFallback />
  if (isFetched && !artist) {
    return <ErrorPage status={404} statusText="Not Found" />
  }
  if (!artist) return <AlbumFallback />

  function getSongCount() {
    if (!artist) return null
    if (artist.albumCount === undefined) return null
    if (artist.albumCount === 0) return null
    if (!artist.album) return null
    let artistSongCount = 0

    artist.album.forEach((album) => {
      artistSongCount += album.songCount
    })

    return t('playlist.songCount', { count: artistSongCount })
  }

  function formatAlbumCount() {
    if (!artist) return null
    if (artist.albumCount === undefined) return null
    if (artist.albumCount === 0) return null

    return t('artist.info.albumsCount', { count: artist.albumCount })
  }

  const albumCount = formatAlbumCount()
  const songCount = getSongCount()

  const badges: BadgesData = [
    {
      content: albumCount,
      type: 'link',
      link: ROUTES.ARTIST.DISCOGRAPHY(artist.id),
    },
    {
      content: songCount,
      type: 'text',
    },
  ]

  return (
    <div className="w-full relative">
      <ArtistStickyHeader artist={artist} />

      <ImageHeader
        type={t('artist.headline')}
        title={artist.name}
        coverArtId={artist.coverArt}
        coverArtType="artist"
        coverArtSize="700"
        coverArtAlt={artist.name}
        badges={badges}
      />

      <ListWrapper>
        <ArtistInfo artist={artist} />

        {topSongsIsLoading && <TopSongsTableFallback />}
        {topSongs && !topSongsIsLoading && (
          <ArtistTopSongs topSongs={topSongs} />
        )}

        {albumSort.sortedAlbums.length > 0 && (
          <section className="w-full flex flex-col gap-4 mt-4 mb-6">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
              {t('artist.discography')}
            </h3>

            {latestRelease && <LatestReleaseCard album={latestRelease} />}

            <ArtistAlbumShelf
              title={t('artist.albums')}
              titleRoute={ROUTES.ARTIST.DISCOGRAPHY(artist.id)}
              albums={albumSort.sortedAlbums}
              controls={
                <AlbumSortControls
                  sortOption={albumSort.sortOption}
                  direction={albumSort.direction}
                  onSortOptionChange={albumSort.changeSortOption}
                  onToggleDirection={albumSort.toggleDirection}
                />
              }
            />
          </section>
        )}

        {artistInfoIsLoading && <PreviewListFallback cardWidth={132} />}
        {similarArtists.length > 0 && !artistInfoIsLoading && (
          <RelatedArtistsList
            title={t('artist.relatedArtists')}
            similarArtists={similarArtists}
          />
        )}

        <ArtistBiography artist={artist} />
      </ListWrapper>
    </div>
  )
}
