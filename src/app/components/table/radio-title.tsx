import clsx from 'clsx'
import { RadioArtwork } from '@/app/components/radios/radio-artwork'
import { usePlayerMediaType, usePlayerSonglist } from '@/store/player.store'
import { Radio } from '@/types/responses/radios'

interface TableRadioTitleProps {
  radio: Radio
}

export function TableRadioTitle({ radio }: TableRadioTitleProps) {
  const { isRadio } = usePlayerMediaType()
  const { radioList, currentSongIndex } = usePlayerSonglist()

  const radioIsPlaying = isRadio && radioList[currentSongIndex]?.id === radio.id

  return (
    <div className="flex gap-2 items-center min-w-[200px] 2xl:min-w-[350px]">
      <RadioArtwork
        radio={radio}
        className="w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded shadow"
        iconClassName="w-5 h-5"
      />
      <div
        className={clsx(
          'flex flex-col justify-center items-center',
          radioIsPlaying && 'text-primary',
        )}
      >
        <p>{radio.name}</p>
      </div>
    </div>
  )
}
