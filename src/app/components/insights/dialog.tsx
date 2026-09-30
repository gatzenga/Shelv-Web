import { AlertTriangle, ChartBar, Loader2, RefreshCw } from 'lucide-react'
import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InsightsIcon } from '@/app/components/icons/phosphor-icons'
import { RankRow } from '@/app/components/insights/rank-row'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { useGetInsights } from '@/app/hooks/use-insights'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes/routesList'
import { usePlayerActions } from '@/store/player.store'

interface InsightsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Segment = 'artists' | 'albums' | 'songs'

function Message({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      {icon}
      {children}
    </div>
  )
}

export function InsightsDialog({ open, onOpenChange }: InsightsDialogProps) {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()
  const [segment, setSegment] = useState<Segment>('artists')
  const { data, isLoading, isFetching, isError, refetch } = useGetInsights(open)

  const close = () => onOpenChange(false)

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

    const rows = {
      artists: data.artists.map((artist, index) => (
        <RankRow
          key={artist.id}
          rank={index + 1}
          title={artist.name}
          playCount={artist.playCount}
          coverArtId={artist.hasImage ? artist.id : undefined}
          coverArtType="artist"
          to={artist.hasImage ? ROUTES.ARTIST.PAGE(artist.id) : undefined}
          onNavigate={close}
        />
      )),
      albums: data.albums.map((album, index) => (
        <RankRow
          key={album.id}
          rank={index + 1}
          title={album.name}
          subtitle={album.artist}
          playCount={album.playCount}
          coverArtId={album.coverArt}
          coverArtType="album"
          to={ROUTES.ALBUM.PAGE(album.id)}
          onNavigate={close}
        />
      )),
      songs: data.songs.map((song, index) => (
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
      )),
    }[segment]

    if (rows.length === 0) return empty

    return (
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-2 pr-3">{rows}</div>
      </ScrollArea>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 cursor-default max-w-xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('insights.title')}</DialogTitle>
        <DialogHeader>
          <div className="flex gap-3 items-center justify-start w-full py-4 px-6 bg-background-foreground border-b border-border">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
              <InsightsIcon className="size-5" />
            </div>
            <h1 className="font-semibold text-lg leading-tight">
              {t('insights.title')}
            </h1>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <Tabs
              value={segment}
              onValueChange={(value) => setSegment(value as Segment)}
              className="flex-1"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="artists">
                  {t('insights.artists')}
                </TabsTrigger>
                <TabsTrigger value="albums">{t('insights.albums')}</TabsTrigger>
                <TabsTrigger value="songs">{t('insights.songs')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              disabled={isFetching}
              onClick={() => refetch()}
              title={t('header.refresh')}
            >
              <RefreshCw
                className={cn('size-4', isFetching && 'animate-spin')}
              />
            </Button>
          </div>

          <div className="h-[55vh] min-h-[320px]">{renderBody()}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
