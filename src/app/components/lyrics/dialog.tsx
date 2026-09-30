import { ArrowDownCircle, Loader2, Trash2, XCircle } from 'lucide-react'
import { ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import {
  cancelLyricsDownload,
  getLyricsStats,
  type LyricsStats,
  resetLyricsDb,
  startLyricsDownload,
} from '@/api/lyrics'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { formatBytes } from '@/utils/formatBytes'

interface LyricsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

export function LyricsDialog({ open, onOpenChange }: LyricsDialogProps) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<LyricsStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const data = await getLyricsStats()
      if (data) setStats(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    loadStats().finally(() => setIsLoading(false))

    const interval = setInterval(() => {
      loadStats()
    }, 1500)

    return () => clearInterval(interval)
  }, [open, loadStats])

  async function handleDownloadAll() {
    try {
      const res = await startLyricsDownload()
      if (res.started) {
        toast.success(t('lyrics.downloadStarted'))
        loadStats()
      } else {
        toast.error(res.message || t('lyrics.downloadError'))
      }
    } catch {
      toast.error(t('lyrics.downloadError'))
    }
  }

  async function handleCancelDownload() {
    try {
      await cancelLyricsDownload()
      toast.info(t('lyrics.downloadCancelled'))
      loadStats()
    } catch {
      // ignore
    }
  }

  async function handleReset() {
    setIsResetting(true)
    try {
      const ok = await resetLyricsDb()
      if (ok) {
        toast.success(t('lyrics.resetSuccess'))
        loadStats()
      } else {
        toast.error(t('lyrics.resetError'))
      }
    } catch {
      toast.error(t('lyrics.resetError'))
    } finally {
      setIsResetting(false)
      setShowResetConfirm(false)
    }
  }

  const spinner = <Loader2 className="size-4 animate-spin inline" />
  const isDownloading = stats?.isDownloading ?? false

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 cursor-default max-w-xl"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{t('lyrics.title')}</DialogTitle>
          <DialogHeader>
            <div className="flex gap-3 items-center justify-start w-full py-4 px-6 bg-background-foreground border-b border-border">
              <h1 className="font-semibold text-lg leading-tight">
                {t('lyrics.title')}
              </h1>
            </div>
          </DialogHeader>

          <div className="w-full max-h-[70vh] overflow-y-auto p-6 flex flex-col gap-5">
            <Section title={t('lyrics.stored')}>
              <Row label={t('lyrics.tracks')}>
                {isLoading && !stats ? (
                  spinner
                ) : isDownloading ? (
                  <span className="font-mono">
                    {stats?.downloadFetched ?? 0} / {stats?.downloadTotal ?? 0}
                  </span>
                ) : (
                  <span className="font-mono">
                    {(stats?.count ?? 0).toLocaleString()}
                  </span>
                )}
              </Row>
              <Row label={t('lyrics.size')}>
                {isLoading && !stats ? (
                  spinner
                ) : !stats || stats.count === 0 ? (
                  t('lyrics.empty')
                ) : (
                  <span className="font-mono">
                    {formatBytes(stats.sizeBytes)}
                  </span>
                )}
              </Row>
            </Section>

            <Section title={t('lyrics.database')}>
              {isDownloading ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t('lyrics.downloading')}
                    </span>
                    <span className="font-mono">
                      {Math.round(
                        ((stats?.downloadFetched ?? 0) /
                          Math.max(stats?.downloadTotal ?? 1, 1)) *
                          100,
                      )}
                      %
                    </span>
                  </div>

                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((stats?.downloadFetched ?? 0) /
                              Math.max(stats?.downloadTotal ?? 1, 1)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelDownload}
                    className="self-start text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-7 text-xs px-2"
                  >
                    <XCircle className="size-3.5 mr-1" />
                    {t('lyrics.cancelDownload')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAll}
                    disabled={isLoading || isResetting}
                    className="gap-2"
                  >
                    <ArrowDownCircle className="size-4" />
                    {t('lyrics.downloadAll')}
                  </Button>
                </div>
              )}

              <div className="flex flex-col items-start gap-2 pt-1 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isDownloading || isResetting}
                  className="gap-2 text-rose-500 hover:text-rose-600 hover:border-rose-500/50"
                >
                  {isResetting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t('lyrics.reset')}
                </Button>
              </div>
            </Section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lyrics.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('lyrics.resetConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('lyrics.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('lyrics.resetConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
