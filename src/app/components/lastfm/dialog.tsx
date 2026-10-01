import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import {
  beginLastFMAuth,
  clearLastFMLogs,
  completeLastFMAuth,
  disconnectLastFM,
  getLastFMLogs,
  getLastFMStatus,
  type LastFMConnectionProblem,
  type LastFMStatus,
  verifyLastFMConnection,
} from '@/api/lastfm'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Switch } from '@/app/components/ui/switch'
import {
  useLastFMMixes,
  useLastFMOptions,
  useLastFMTopSongs,
} from '@/store/lastfm-options.store'

interface LastFMDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function LastFMIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11.996 0C5.372 0 0 5.373 0 12c0 6.628 5.372 12 11.996 12 6.628 0 12.004-5.372 12.004-12 0-6.627-5.376-12-12.004-12zm6.27 16.924c-1.077 0-1.895-.443-2.42-1.319l-.39-.702c-.878 1.295-2.072 2.021-3.568 2.021-2.44 0-4.14-1.745-4.14-4.244 0-2.82 2.025-4.385 4.35-4.385 2.457 0 3.834 1.487 4.142 3.754l-1.758.263c-.22-1.372-.98-2.28-2.384-2.28-1.42 0-2.42 1.054-2.42 2.648 0 1.56.965 2.508 2.385 2.508 1.353 0 2.22-.843 2.684-2.07l.544-1.474c.456-1.228 1.492-2.001 2.87-2.001 1.701 0 2.87 1.157 2.87 2.842v4.44h-3.265v-.002zm-3.504-4.832c-.088-.44-.298-.79-.667-.79-.544 0-.878.473-.878 1.28 0 .807.334 1.28.878 1.28.42 0 .685-.35.79-.84l-.123-.93z" />
    </svg>
  )
}

function getProblemMessage(
  problem: LastFMConnectionProblem | null,
  t: (key: string) => string,
): string {
  if (!problem) return ''
  if (typeof problem === 'string') {
    switch (problem) {
      case 'invalidAPIKey':
        return t('lastfm.errors.apiKey')
      case 'invalidSecret':
        return t('lastfm.errors.secret')
      case 'accessRevoked':
        return t('lastfm.errors.revoked')
      case 'authorizationIncomplete':
        return t('lastfm.errors.notAuthorized')
      case 'unreachable':
        return t('lastfm.errors.unreachable')
    }
  }
  return problem.other
}

export function LastFMDialog({ open, onOpenChange }: LastFMDialogProps) {
  const { t } = useTranslation()
  const topSongs = useLastFMTopSongs()
  const mixes = useLastFMMixes()
  const setTopSongs = useLastFMOptions((state) => state.setTopSongs)
  const setMixes = useLastFMOptions((state) => state.setMixes)
  const [status, setStatus] = useState<LastFMStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [pendingToken, setPendingTokenState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('lastfm_pending_token')
    } catch {
      return null
    }
  })

  const updatePendingToken = useCallback((tok: string | null) => {
    setPendingTokenState(tok)
    try {
      if (tok) {
        sessionStorage.setItem('lastfm_pending_token', tok)
      } else {
        sessionStorage.removeItem('lastfm_pending_token')
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, [])

  const refreshLogs = useCallback(async () => {
    try {
      const entries = await getLastFMLogs()
      setLogs(entries)
    } catch {
      // Ignore background log fetch failure
    }
  }, [])

  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [fetchedStatus, fetchedLogs] = await Promise.all([
        getLastFMStatus(),
        getLastFMLogs(),
      ])
      setStatus(fetchedStatus)
      setLogs(fetchedLogs)
    } catch {
      // Ignore initial load failure
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      refreshData()
    }
  }, [open, refreshData])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // only the page of this app, which the popup of Last.fm returns to
      if (event.origin !== window.location.origin) return

      if (event.data?.type === 'lastfm-auth-result') {
        refreshData()
        updatePendingToken(null)
        setIsAuthorizing(false)
        if (event.data.success) {
          toast.success(t('lastfm.connect'))
        } else {
          toast.error(t('lastfm.errors.notAuthorized'))
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [refreshData, t, updatePendingToken])

  const handleConnect = async () => {
    setIsAuthorizing(true)
    try {
      const callback = `${window.location.origin}/api/lastfm/auth/callback`
      const { token, authUrl } = await beginLastFMAuth(callback)
      updatePendingToken(token)

      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        authUrl,
        'lastfm-auth',
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      let pollAttempts = 0
      const maxAttempts = 45 // 90 seconds
      const pollTimer = setInterval(async () => {
        pollAttempts++
        try {
          const res = await completeLastFMAuth(token)
          if (res.state === 'connected') {
            clearInterval(pollTimer)
            clearInterval(closedCheckTimer)
            updatePendingToken(null)
            setIsAuthorizing(false)
            popup?.close()
            setStatus(res)
            refreshLogs()
            toast.success(
              t('lastfm.status.connected', { username: res.username || '' }),
            )
          }
        } catch {
          // not ready yet
        }

        if (pollAttempts >= maxAttempts) {
          clearInterval(pollTimer)
          clearInterval(closedCheckTimer)
          setIsAuthorizing(false)
        }
      }, 2000)

      const closedCheckTimer = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(closedCheckTimer)
          clearInterval(pollTimer)
          setIsAuthorizing(false)
          try {
            const res = await completeLastFMAuth(token)
            if (res.state === 'connected') {
              updatePendingToken(null)
              setStatus(res)
              refreshLogs()
              toast.success(
                t('lastfm.status.connected', { username: res.username || '' }),
              )
            }
          } catch {
            // closed without completing auth
          }
        }
      }, 1000)
    } catch {
      setIsAuthorizing(false)
      toast.error(t('lastfm.errors.apiKey'))
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      if (pendingToken && status?.state !== 'connected') {
        try {
          const res = await completeLastFMAuth(pendingToken)
          if (res.state === 'connected') {
            updatePendingToken(null)
            setStatus(res)
            refreshLogs()
            toast.success(
              t('lastfm.status.connected', { username: res.username || '' }),
            )
            return
          }
        } catch {
          // Fall back to regular verify
        }
      }

      const updated = await verifyLastFMConnection()
      setStatus(updated)
      refreshLogs()
      if (updated.state === 'connected') {
        updatePendingToken(null)
        toast.success(
          t('lastfm.status.connected', { username: updated.username || '' }),
        )
      }
    } catch {
      toast.error(t('lastfm.errors.unreachable'))
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      updatePendingToken(null)
      const updated = await disconnectLastFM()
      setStatus(updated)
      toast.success(t('lastfm.disconnect'))
      refreshLogs()
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      await clearLastFMLogs()
      setLogs([])
      toast.success(t('lastfm.logs.clear'))
    } catch {
      toast.error('Failed to clear logs')
    }
  }

  const isConnected = status?.state === 'connected'
  const isChecking =
    status?.state === 'checking' || isVerifying || isAuthorizing
  const isFailed = status?.state === 'failed'
  const isNotConfigured = status?.state === 'notConfigured'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 cursor-default max-w-2xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('lastfm.title')}</DialogTitle>
        <DialogHeader>
          <div className="flex gap-3 items-center justify-start w-full py-4 px-6 bg-background-foreground border-b border-border">
            <div className="flex items-center justify-center size-9 rounded-lg bg-red-600/10 text-red-500">
              <LastFMIcon className="size-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">
                {t('lastfm.title')}
              </h1>
              <p className="text-xs text-muted-foreground">
                Last.fm Scrobble &amp; Smart Mix Integration
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="w-full p-6 flex flex-col gap-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('lastfm.footer')}
          </p>

          <div className="rounded-xl border border-border bg-card/50 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </span>
              {status?.lastChecked && (
                <span className="text-xs text-muted-foreground">
                  {new Date(status.lastChecked).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>{t('generic.loading')}</span>
                </div>
              ) : isConnected ? (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                  <CheckCircle2 className="size-4" />
                  <span>
                    {t('lastfm.status.connected', {
                      username: status.username || '',
                    })}
                  </span>
                </div>
              ) : isChecking ? (
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t('lastfm.status.checking')}</span>
                </div>
              ) : isFailed ? (
                <div className="flex items-center gap-2 text-sm font-medium text-rose-500">
                  <XCircle className="size-4" />
                  <span>{getProblemMessage(status.problem, t)}</span>
                </div>
              ) : isNotConfigured ? (
                <div className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertCircle className="size-4" />
                  <span>{t('lastfm.status.notConfigured')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Radio className="size-4" />
                  <span>{t('lastfm.status.notConnected')}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              {isConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerify}
                    disabled={isChecking}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <RefreshCw
                      className={`size-3.5 ${isChecking ? 'animate-spin' : ''}`}
                    />
                    {t('lastfm.checkConnection')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="gap-1.5 h-8 text-xs ml-auto"
                  >
                    {t('lastfm.disconnect')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnect}
                    disabled={isNotConfigured || isChecking}
                    className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                  >
                    <ExternalLink className="size-3.5" />
                    {t('lastfm.connect')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerify}
                    disabled={isChecking || isNotConfigured}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <RefreshCw
                      className={`size-3.5 ${isChecking ? 'animate-spin' : ''}`}
                    />
                    {t('lastfm.checkConnection')}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4 flex flex-col gap-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('lastfm.options.title')}
            </span>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {t('lastfm.options.topSongs')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('lastfm.options.topSongsHint')}
                </span>
              </div>
              <Switch
                checked={topSongs}
                onCheckedChange={setTopSongs}
                disabled={isNotConfigured}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {t('lastfm.options.mixes')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('lastfm.options.mixesHint')}
                </span>
              </div>
              <Switch
                checked={mixes}
                onCheckedChange={setMixes}
                disabled={isNotConfigured}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('lastfm.logs.title')}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshLogs}
                  title={t('lastfm.logs.refresh')}
                  className="size-7"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  title={t('lastfm.logs.clear')}
                  className="size-7 text-muted-foreground hover:text-rose-500"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-black/40 p-3 h-52">
              <ScrollArea className="h-full w-full">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-44 text-muted-foreground text-xs gap-1.5">
                    <p>{t('lastfm.logs.empty')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 font-mono text-[11px] leading-relaxed">
                    {logs.map((entry, i) => {
                      const isSuccess = entry.includes('✓')
                      const isFailure = entry.includes('✗')
                      return (
                        <div
                          key={`${i}-${entry.slice(0, 20)}`}
                          className={`whitespace-pre-wrap break-all ${
                            isSuccess
                              ? 'text-emerald-400'
                              : isFailure
                                ? 'text-rose-400'
                                : 'text-zinc-300'
                          }`}
                        >
                          {entry}
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
