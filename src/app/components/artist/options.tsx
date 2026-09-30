import { OptionsButtons } from '@/app/components/options/buttons'
import { ContextMenuSeparator } from '@/app/components/ui/context-menu'
import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'
import { useOptions } from '@/app/hooks/use-options'
import { useShare } from '@/app/hooks/use-share'
import { useSongList } from '@/app/hooks/use-song-list'
import { usePlayerActions } from '@/store/player.store'
import { IArtist } from '@/types/responses/artist'
import { ISong } from '@/types/responses/song'

interface ArtistOptionsProps {
  artist: Pick<IArtist, 'id' | 'name'>
  variant?: 'dropdown' | 'context'
}

export function ArtistOptions({
  artist,
  variant = 'dropdown',
}: ArtistOptionsProps) {
  const { getArtistPlayOrderSongs } = useSongList()
  const { setSongList } = usePlayerActions()
  const { playLast, playNext, startInstantMix } = useOptions()
  const { share } = useShare()

  const Separator =
    variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator

  async function getSongs(): Promise<ISong[]> {
    return await getArtistPlayOrderSongs({
      artistId: artist.id,
      artistName: artist.name,
    })
  }

  async function handlePlay() {
    const songs = await getSongs()
    if (songs.length === 0) return
    setSongList(songs, 0, false, {
      id: artist.id,
      name: artist.name,
      type: 'artist',
    })
  }

  async function handleShuffle() {
    const songs = await getSongs()
    if (songs.length === 0) return
    setSongList(songs, 0, true, {
      id: artist.id,
      name: artist.name,
      type: 'artist',
    })
  }

  async function handlePlayNext() {
    const songs = await getSongs()
    if (songs.length === 0) return
    playNext(songs)
  }

  async function handlePlayLast() {
    const songs = await getSongs()
    if (songs.length === 0) return
    playLast(songs)
  }

  return (
    <>
      <DropdownMenuGroup>
        {/* Section 1: Play, Shuffle */}
        <OptionsButtons.Play variant={variant} onClick={handlePlay} />
        <OptionsButtons.Shuffle variant={variant} onClick={handleShuffle} />

        <Separator />

        {/* Section 2: Instant Mix */}
        <OptionsButtons.InstantMix
          variant={variant}
          onClick={() => startInstantMix('artist', artist.id)}
        />

        <Separator />

        {/* Section 3: Play Next, Add to Queue */}
        <OptionsButtons.PlayNext variant={variant} onClick={handlePlayNext} />
        <OptionsButtons.PlayLast variant={variant} onClick={handlePlayLast} />

        <Separator />

        {/* Section 4: Share */}
        <OptionsButtons.Share
          variant={variant}
          onClick={() => share(artist.id)}
        />
      </DropdownMenuGroup>
    </>
  )
}
