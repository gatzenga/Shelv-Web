import { MouseEvent } from 'react'

// A click on a row of a song list plays the song, wherever on the row it is.
// Links and buttons inside the row keep their own action.
export function playOnClick(onPlay: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) return

    onPlay()
  }
}
