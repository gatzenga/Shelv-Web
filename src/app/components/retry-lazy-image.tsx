import { ComponentProps, useEffect, useRef, useState } from 'react'
import { LazyLoadImage } from 'react-lazy-load-image-component'

// Navidrome gives a cover ten seconds. A large one that is made for the first
// time, or many at once, can take longer: the picture fails, and would stay
// empty until the page is opened again, while the cover is there a moment
// later. So a picture from the library that fails is asked for again.
const retryDelays = [2000, 5000, 12000]

export function RetryLazyImage({
  src,
  onError,
  ...props
}: ComponentProps<typeof LazyLoadImage>) {
  const [attempt, setAttempt] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new picture starts again
  useEffect(() => {
    setAttempt(0)
    return () => clearTimeout(timer.current)
  }, [src])

  const isFromLibrary = src?.includes('/rest/') ?? false
  const url =
    attempt > 0 && src
      ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
      : src

  return (
    <LazyLoadImage
      {...props}
      src={url}
      onError={(event) => {
        onError?.(event)
        if (!isFromLibrary || attempt >= retryDelays.length) return

        timer.current = setTimeout(
          () => setAttempt((value) => value + 1),
          retryDelays[attempt],
        )
      }}
    />
  )
}
