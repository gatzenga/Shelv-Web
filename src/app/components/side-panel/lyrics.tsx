import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { isSafari } from 'react-device-detect'
import { useTranslation } from 'react-i18next'
import {
  ScrollArea,
  scrollAreaViewportSelector,
} from '@/app/components/ui/scroll-area'
import { subsonic } from '@/service/subsonic'
import { useLang } from '@/store/lang.store'
import { usePlayerRef, usePlayerSonglist } from '@/store/player.store'
import { ILyric } from '@/types/responses/song'
import { queryKeys } from '@/utils/queryKeys'

// disambiguates chinese language code to the user's locale if set
function resolveLyricsLang(
  lyricsLang: string | undefined,
  appLocale: string,
): string | undefined {
  if (!lyricsLang || lyricsLang !== 'zh') return lyricsLang
  if (appLocale === 'yue-Hant') return 'zh-Hant'
  return 'zh-Hans'
}

interface LyricProps {
  lyrics: ILyric
}

export function LyricsTab() {
  const { currentSong } = usePlayerSonglist()
  const { t } = useTranslation()

  const { id, artist, title, duration } = currentSong

  const { data: lyrics, isLoading } = useQuery({
    queryKey: [queryKeys.song.lyrics, artist, title, duration],
    queryFn: () =>
      subsonic.lyrics.getLyrics({
        id,
        artist,
        title,
        duration,
      }),
  })

  const noLyricsFound = t('fullscreen.noLyrics')
  const loadingLyrics = t('fullscreen.loadingLyrics')

  if (isLoading) {
    return <CenteredMessage>{loadingLyrics}</CenteredMessage>
  } else if (lyrics && lyrics.value) {
    return areLyricsSynced(lyrics) ? (
      <SyncedLyrics lyrics={lyrics} />
    ) : (
      <UnsyncedLyrics lyrics={lyrics} />
    )
  } else {
    return <CenteredMessage>{noLyricsFound}</CenteredMessage>
  }
}

interface LrcLine {
  time: number
  text: string
}

// "[01:23.45] text", a line can have several times
function parseLrc(value: string): LrcLine[] {
  const lines: LrcLine[] = []

  for (const raw of value.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)]
    if (stamps.length === 0) continue

    const text = raw.replace(/\[[^\]]*\]/g, '').trim()

    for (const [, minutes, seconds] of stamps) {
      lines.push({
        time: Number(minutes) * 60 + Number(seconds.replace(':', '.')),
        text,
      })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

// Where the current line sits in the panel, like the lyrics of the Shelv
// app: near the top, so the lines to come are visible below it
const ACTIVE_LINE_ANCHOR = 0.2
const RESUME_AUTO_SCROLL_MS = 2500

function SyncedLyrics({ lyrics }: LyricProps) {
  const playerRef = usePlayerRef()
  const { langCode } = useLang()
  const resolvedLang = resolveLyricsLang(lyrics.lang, langCode)

  const lines = useMemo(() => parseLrc(lyrics.value ?? ''), [lyrics.value])
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const pausedUntil = useRef(0)
  // the scroll callback reads the index from here, it does not change with it
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const interval = setInterval(() => {
      const time = playerRef?.currentTime ?? 0

      let index = -1
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= time) index = i
        else break
      }

      setActiveIndex((previous) => (previous === index ? previous : index))
    }, 100)

    return () => clearInterval(interval)
  }, [playerRef, lines])

  const scrollToActive = useCallback((smooth: boolean) => {
    const container = containerRef.current
    const line = lineRefs.current[activeIndexRef.current]
    if (!container || !line) return

    container.scrollTo({
      top: Math.max(
        0,
        line.offsetTop - container.clientHeight * ACTIVE_LINE_ANCHOR,
      ),
      behavior: smooth && !isSafari ? 'smooth' : 'auto',
    })
  }, [])

  useEffect(() => {
    if (activeIndex < 0 || Date.now() < pausedUntil.current) return

    scrollToActive(true)
  }, [activeIndex, scrollToActive])

  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  // Scrolling by hand pauses the automatic scrolling for a moment
  function pauseAutoScroll() {
    pausedUntil.current = Date.now() + RESUME_AUTO_SCROLL_MS
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(
      () => scrollToActive(true),
      RESUME_AUTO_SCROLL_MS,
    )
  }

  const skipToTime = (time: number) => {
    if (playerRef) playerRef.currentTime = time
  }

  return (
    <div
      ref={containerRef}
      onWheel={pauseAutoScroll}
      onTouchMove={pauseAutoScroll}
      className="relative w-full h-full overflow-y-auto text-center font-semibold text-lg px-2 pt-4 pb-[60%] maskImage-lyrics"
      id="sync-lyrics-box"
    >
      {lines.map((line, index) => (
        <p
          key={index}
          ref={(element) => {
            lineRefs.current[index] = element
          }}
          onClick={() => skipToTime(line.time)}
          className={clsx(
            'my-3 cursor-pointer hover:opacity-100 duration-500',
            'transition-[opacity,transform] motion-reduce:transition-none',
            index === activeIndex ? 'opacity-100 scale-105' : 'opacity-50',
          )}
          lang={resolvedLang}
        >
          {line.text || '\u00a0'}
        </p>
      ))}
    </div>
  )
}

function UnsyncedLyrics({ lyrics }: LyricProps) {
  const { currentSong } = usePlayerSonglist()
  const { langCode } = useLang()
  const lyricsBoxRef = useRef<HTMLDivElement>(null)
  const resolvedLang = resolveLyricsLang(lyrics.lang, langCode)

  const lines = lyrics.value!.split('\n')

  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when song changes
  useEffect(() => {
    if (lyricsBoxRef.current) {
      const scrollArea = lyricsBoxRef.current.querySelector(
        scrollAreaViewportSelector,
      ) as HTMLDivElement

      scrollArea.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }, [currentSong])

  return (
    <ScrollArea
      type="always"
      className="w-full h-full overflow-y-auto text-center font-semibold text-base px-2 scroll-smooth maskImage-unsynced-lyrics"
      thumbClassName="secondary-thumb-bar"
      ref={lyricsBoxRef}
    >
      {lines.map((line, index) => (
        <p
          key={index}
          className={clsx(
            'leading-8 text-balance',
            index === 0 && 'mt-4',
            index === lines.length - 1 && 'mb-16',
          )}
          lang={resolvedLang}
        >
          {line}
        </p>
      ))}
    </ScrollArea>
  )
}

type CenteredMessageProps = ComponentPropsWithoutRef<'p'>

function CenteredMessage({ children }: CenteredMessageProps) {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <p className="text-center text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function areLyricsSynced(lyrics: ILyric) {
  // Most LRC files start with the string "[00:" or "[01:" indicating synced lyrics
  const lyric = lyrics.value?.trim() ?? ''
  return (
    lyric.startsWith('[00:') ||
    lyric.startsWith('[01:') ||
    lyric.startsWith('[02:')
  )
}
