import { ISong } from '@/types/responses/song'
import { ensureSupportForAlac } from '@/utils/alac'

interface PlayerAudioBadgeProps {
  song: ISong | undefined
}

// Shows what is actually streamed: the codec and, when the server sends the
// original file, its bitrate. Transcoded streams (ALAC → Opus) have no known
// bitrate.
export function PlayerAudioBadge({ song }: PlayerAudioBadgeProps) {
  if (!song?.suffix) return null

  const streamSuffix = ensureSupportForAlac(song.suffix) ?? song.suffix
  const isTranscoded = streamSuffix !== song.suffix
  const codec = streamSuffix.toUpperCase()
  const label =
    !isTranscoded && song.bitRate ? `${codec} · ${song.bitRate} kbps` : codec

  return (
    <span
      className="hidden xl:block mr-2 text-xs text-muted-foreground whitespace-nowrap tabular-nums"
      data-testid="player-audio-badge"
    >
      {label}
    </span>
  )
}
