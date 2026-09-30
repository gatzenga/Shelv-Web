import { AlertTriangle, ChartBar, Loader2, Play } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import { Link } from 'react-router-dom'
import { ImageLoader } from '@/app/components/image-loader'
import { Button } from '@/app/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/app/components/ui/tabs'
import { useGetInsights } from '@/app/hooks/use-insights'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes/routesList'
import { usePlayerActions } from '@/store/player.store'
import { CoverArt } from '@/types/coverArtType'

interface RankRowProps {
  rank: number
  title: string
  subtitle?: string
  playCount?: number
  coverArtId?: string
  coverArtType: CoverArt
  to?: string
  onClick?: () => void
}

function RankRow({
  rank,
  title,
  subtitle,
  playCount,
  coverArtId,
  coverArtType,
  to,
  onClick,
}: RankRowProps) {
  const isTop3 = rank <= 3

  const content = (
    <>
      <span
        className={cn(
          'w-7 shrink-0 text-right tabular-nums font-bold',
          isTop3 ? 'text-xl text-primary' : 'text-sm text-muted-foreground',
        )}
      >
        {rank}
      </span>

      <div
        className={cn(
          'size-[52px] shrink-0 overflow-hidden bg-skeleton',
          coverArtType === 'artist' ? 'rounded-full' : 'rounded-lg',
        )}
      >
        <ImageLoader id={coverArtId} type={coverArtType} size="100">
          {(src) => (
            <LazyLoadImage
              src={src}
              alt={title}
              effect="opacity"
              width={52}
              height={52}
              className="size-full object-cover"
            />
          )}
        </ImageLoader>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', isTop3 ? 'font-bold' : 'font-medium')}>
          {title}
        </span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>

      {playCount !== undefined && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs tabular-nums',
            isTop3
              ? 'bg-primary/15 text-primary'
              : 'bg-muted-foreground/10 text-muted-foreground',
          )}
        >
          <Play className="size-2.5 fill-current" />
          {playCount}
        </span>
      )}
    </>
  )

  const className = cn(
    'flex w-full items-center gap-3 rounded-[14px] px-3.5 text-left transition-colors',
    isTop3
      ? 'border border-primary/25 bg-primary/10 py-2.5 hover:bg-primary/15'
      : 'bg-muted/40 py-1.5 hover:bg-muted/70',
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

function Message({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
      {icon}
      {children}
    </div>
  )
}

export default function Insights() {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()
  const { data, isLoading, isError, refetch } = useGetInsights()

  function renderBody() {
    if (isLoading) {
      return (
        <Message icon={<Loader2 className="size-8 animate-spin" />}>
          {t('insights.loading')}
        </Message>
      )
    }

    if (isError || !data) {
      return (
        <Message icon={<AlertTriangle className="size-10" />}>
          <p>{t('insights.error')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('insights.retry')}
          </Button>
        </Message>
      )
    }

    const empty = (
      <Message icon={<ChartBar className="size-12 opacity-30" />}>
        {t('insights.empty')}
      </Message>
    )

    return (
      <>
        <TabsContent value="artists" className="mt-4 flex flex-col gap-2">
          {data.artists.length === 0
            ? empty
            : data.artists.map((artist, index) => (
                <RankRow
                  key={artist.id}
                  rank={index + 1}
                  title={artist.name}
                  playCount={artist.playCount}
                  coverArtId={artist.hasImage ? artist.id : undefined}
                  coverArtType="artist"
                  to={
                    artist.hasImage ? ROUTES.ARTIST.PAGE(artist.id) : undefined
                  }
                />
              ))}
        </TabsContent>

        <TabsContent value="albums" className="mt-4 flex flex-col gap-2">
          {data.albums.length === 0
            ? empty
            : data.albums.map((album, index) => (
                <RankRow
                  key={album.id}
                  rank={index + 1}
                  title={album.name}
                  subtitle={album.artist}
                  playCount={album.playCount}
                  coverArtId={album.coverArt}
                  coverArtType="album"
                  to={ROUTES.ALBUM.PAGE(album.id)}
                />
              ))}
        </TabsContent>

        <TabsContent value="songs" className="mt-4 flex flex-col gap-2">
          {data.songs.length === 0
            ? empty
            : data.songs.map((song, index) => (
                <RankRow
                  key={song.id}
                  rank={index + 1}
                  title={song.title}
                  subtitle={song.artist}
                  playCount={song.playCount}
                  coverArtId={song.coverArt}
                  coverArtType="album"
                  onClick={() =>
                    setSongList(data.songs, index, false, {
                      id: 'insights',
                      name: t('insights.title'),
                      type: 'songs',
                    })
                  }
                />
              ))}
        </TabsContent>
      </>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        {t('insights.title')}
      </h1>

      <Tabs defaultValue="artists">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="artists">{t('insights.artists')}</TabsTrigger>
          <TabsTrigger value="albums">{t('insights.albums')}</TabsTrigger>
          <TabsTrigger value="songs">{t('insights.songs')}</TabsTrigger>
        </TabsList>

        {renderBody()}
      </Tabs>
    </div>
  )
}
