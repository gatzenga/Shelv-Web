import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCw,
  XCircle,
} from 'lucide-react'
import { ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { getServerOverview, ServerOverview } from '@/service/server-overview'
import { subsonic } from '@/service/subsonic'
import { useAppData } from '@/store/app.store'

interface ManageServersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const lastSyncKey = 'shelv_web_last_sync'
const scanPollInterval = 2000
const refreshBatchSize = 3
const refreshPause = 300

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      <div className="rounded-xl border border-border bg-card/50 p-4 flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground text-right break-all">
        {children}
      </span>
    </div>
  )
}

function readLastSync() {
  try {
    const value = Number(localStorage.getItem(lastSyncKey))

    return value > 0 ? value : null
  } catch {
    return null
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ManageServersDialog({
  open,
  onOpenChange,
}: ManageServersDialogProps) {
  const { t, i18n } = useTranslation()
  const { username, url } = useAppData()
  const [overview, setOverview] = useState<ServerOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [metadataResult, setMetadataResult] = useState<'done' | 'failed'>()
  const [failedCount, setFailedCount] = useState(0)
  const [totalForMessage, setTotalForMessage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<number | null>(readLastSync)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setOverview(await getServerOverview())
    } catch {
      setOverview(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function runFullSync() {
    setIsScanning(true)
    setScanDone(false)
    setError(null)

    try {
      let status = await subsonic.library.startScan()
      while (String(status?.scanning) === 'true') {
        await sleep(scanPollInterval)
        status = await subsonic.library.getScanStatus()
      }

      const now = Date.now()
      setLastSync(now)
      try {
        localStorage.setItem(lastSyncKey, String(now))
      } catch {
        // The time is only shown, losing it is fine
      }
      setScanDone(true)
      await load()
    } catch (scanError) {
      setError(
        scanError instanceof Error ? scanError.message : String(scanError),
      )
    } finally {
      setIsScanning(false)
    }
  }

  // Asks Navidrome for the info of every artist in small steps. Info that is
  // out of date is fetched again in the background by the server.
  async function runMetadataRefresh() {
    setIsRefreshing(true)
    setMetadataResult(undefined)
    setError(null)
    setFailedCount(0)

    try {
      const artists = await subsonic.artists.getAll()
      let failed = 0

      for (let start = 0; start < artists.length; start += refreshBatchSize) {
        const batch = artists.slice(start, start + refreshBatchSize)
        const results = await Promise.allSettled(
          batch.map((artist) => subsonic.artists.getInfo(artist.id)),
        )

        failed += results.filter(
          (result) => result.status === 'rejected',
        ).length
        setProgress({
          done: Math.min(start + refreshBatchSize, artists.length),
          total: artists.length,
        })
        await sleep(refreshPause)
      }

      setFailedCount(failed)
      setMetadataResult(failed > 0 ? 'failed' : 'done')
      setTotalForMessage(artists.length)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : String(refreshError),
      )
    } finally {
      setIsRefreshing(false)
      setProgress(undefined)
    }
  }

  function formatLastSync() {
    if (!lastSync) return t('server.never')

    const minutes = Math.round((lastSync - Date.now()) / 60000)
    const formatter = new Intl.RelativeTimeFormat(i18n.language, {
      numeric: 'auto',
    })

    if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
    if (Math.abs(minutes) < 60 * 24) {
      return formatter.format(Math.round(minutes / 60), 'hour')
    }

    return formatter.format(Math.round(minutes / (60 * 24)), 'day')
  }

  const spinner = <Loader2 className="size-4 animate-spin inline" />
  const busy = isScanning || isRefreshing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 cursor-default max-w-xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('menu.manageServers')}</DialogTitle>
        <DialogHeader>
          <div className="flex gap-3 items-center justify-start w-full py-4 px-6 bg-background-foreground border-b border-border">
            <h1 className="font-semibold text-lg leading-tight">
              {t('menu.manageServers')}
            </h1>
          </div>
        </DialogHeader>

        <div className="w-full max-h-[70vh] overflow-y-auto p-6 flex flex-col gap-5">
          <Section title={t('server.connected')}>
            <Row label="URL">{overview?.navidromeUrl ?? url}</Row>
            <Row label={t('server.user')}>{username}</Row>
            <Row label={t('about.version')}>
              {isLoading
                ? spinner
                : overview?.serverVersion
                  ? `${overview.serverVersion}${overview.serverType ? ` (${overview.serverType})` : ''}`
                  : '–'}
            </Row>
            <Row label="API">
              {isLoading ? spinner : (overview?.apiVersion ?? '–')}
            </Row>
          </Section>

          <Section title={t('server.library')}>
            <Row label={t('server.albums')}>
              {isLoading ? spinner : (overview?.albums ?? '–')}
            </Row>
            <Row label={t('server.artists')}>
              {isLoading ? spinner : (overview?.artists ?? '–')}
            </Row>
            <Row label={t('server.tracks')}>
              {isLoading ? spinner : (overview?.tracks ?? '–')}
            </Row>
          </Section>

          <Section title={t('server.synchronisation')}>
            <Row label={t('server.lastSync')}>{formatLastSync()}</Row>

            <div className="flex flex-col items-start gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={runFullSync}
                className="gap-2"
              >
                <RefreshCw className="size-4" />
                {t('server.fullSync')}
              </Button>
              {isScanning && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('server.scanning')}
                </span>
              )}
              {scanDone && !isScanning && (
                <span className="flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle2 className="size-4" />
                  {t('server.syncComplete')}
                </span>
              )}
            </div>

            <div className="flex flex-col items-start gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={runMetadataRefresh}
                className="gap-2"
              >
                <RotateCw className="size-4" />
                {t('server.refreshMetadata')}
              </Button>
              {progress && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('server.refreshing', progress)}
                </span>
              )}
              {metadataResult === 'done' && (
                <span className="flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle2 className="size-4" />
                  {t('server.metadataComplete')}
                </span>
              )}
              {metadataResult === 'failed' && (
                <span className="flex items-center gap-2 text-sm text-rose-500">
                  <XCircle className="size-4" />
                  {t('server.metadataFailed', {
                    failed: failedCount,
                    total: totalForMessage,
                  })}
                </span>
              )}
            </div>

            {error && (
              <span className="flex items-center gap-2 text-xs text-rose-500">
                <XCircle className="size-4 shrink-0" />
                {error}
              </span>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
