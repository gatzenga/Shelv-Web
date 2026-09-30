import { RadioIcon } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { MarqueeTitle } from '@/app/components/marquee-title'
import { RadioArtwork } from '@/app/components/radios/radio-artwork'
import { useRadioNowPlayingState } from '@/store/radio-playback.store'
import { Radio } from '@/types/responses/radios'
import { displayArtist, displayTitle } from '@/utils/radioMetadata'

export function RadioInfo({ radio }: { radio: Radio | undefined }) {
  const { t } = useTranslation()
  const { nowPlaying, isConnecting } = useRadioNowPlayingState()

  if (!radio) {
    return (
      <Fragment>
        <div className="w-[70px] h-[70px] flex justify-center items-center bg-foreground/20 rounded">
          <RadioIcon
            className="w-12 h-12"
            strokeWidth={1}
            data-testid="radio-icon"
          />
        </div>
        <div className="flex flex-col justify-center w-full text-left overflow-hidden">
          <span className="text-sm font-medium" data-testid="radio-no-playing">
            {t('player.noRadioPlaying')}
          </span>
        </div>
      </Fragment>
    )
  }

  // Shelv: the title falls back to the station name, the artist line shows
  // the connection state while (re)connecting
  const title = displayTitle(nowPlaying)
  const artist = displayArtist(nowPlaying)
  const subtitle = isConnecting ? t('radios.connecting') : artist

  return (
    <Fragment>
      <RadioArtwork
        radio={radio}
        artworkUrl={nowPlaying?.artworkUrl ?? null}
        className="w-[70px] h-[70px] min-w-[70px] rounded shadow-md"
        iconClassName="w-12 h-12"
      />
      <div className="flex flex-col justify-center w-full text-left overflow-hidden">
        {title ? (
          <Fragment>
            <MarqueeTitle gap="mr-6">
              <span className="text-sm font-medium" data-testid="radio-title">
                {title}
              </span>
            </MarqueeTitle>
            <span
              className="text-xs font-light text-muted-foreground truncate"
              data-testid="radio-artist"
            >
              {subtitle}
            </span>
          </Fragment>
        ) : (
          <Fragment>
            <span className="text-sm font-medium" data-testid="radio-name">
              {radio.name}
            </span>
            <span
              className="text-xs font-light text-muted-foreground"
              data-testid="radio-label"
            >
              {subtitle || t('radios.label')}
            </span>
          </Fragment>
        )}
      </div>
    </Fragment>
  )
}
