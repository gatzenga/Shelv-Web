import { RadioIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSimpleCoverArtUrl } from '@/api/httpClient'
import { cn } from '@/lib/utils'
import { Radio } from '@/types/responses/radios'

interface RadioArtworkProps {
  radio: Radio
  // song or station art from AzuraCast/SUB/WAVE, already proxied
  artworkUrl?: string | null
  className?: string
  iconClassName?: string
}

// Shelv: the song cover of the metadata source first, then the image
// uploaded to the station in Navidrome, then a radio icon
export function RadioArtwork({
  radio,
  artworkUrl,
  className,
  iconClassName,
}: RadioArtworkProps) {
  const stationCoverUrl = radio.coverArt
    ? getSimpleCoverArtUrl(radio.coverArt, 'album', '300')
    : null
  const candidates = [artworkUrl, stationCoverUrl].filter(
    (url): url is string => Boolean(url),
  )
  const candidatesKey = candidates.join('|')
  const [failed, setFailed] = useState<string[]>([])

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the images change
  useEffect(() => {
    setFailed([])
  }, [candidatesKey])

  const src = candidates.find((url) => !failed.includes(url))

  return (
    <div
      className={cn(
        'flex justify-center items-center overflow-hidden bg-foreground/20 dark:bg-accent',
        className,
      )}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={radio.name}
          className="w-full h-full object-cover"
          data-testid="radio-artwork"
          onError={() => setFailed((current) => [...current, src])}
        />
      ) : (
        <RadioIcon
          className={cn('text-foreground', iconClassName)}
          strokeWidth={1}
          data-testid="radio-icon"
        />
      )}
    </div>
  )
}
