import { OptionsButtons } from '@/app/components/options/buttons'
import { AddToPlaylistSubMenu } from '@/app/components/song/add-to-playlist'
import { ContextMenuSeparator } from '@/app/components/ui/context-menu'
import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'
import { useOptions } from '@/app/hooks/use-options'
import { useShare } from '@/app/hooks/use-share'
import { useSongList } from '@/app/hooks/use-song-list'
import { useAppStore } from '@/store/app.store'
import { usePlayerActions } from '@/store/player.store'
import { Albums, SingleAlbum } from '@/types/responses/album'
import { ISong } from '@/types/responses/song'

interface AlbumOptionsProps {
  album: Albums | SingleAlbum
  variant?: 'dropdown' | 'context'
}

export function AlbumOptions({
  album,
  variant = 'dropdown',
}: AlbumOptionsProps) {
  const hidePlaylistsSection = useAppStore().pages.hidePlaylistsSection
  const { getAlbumSongs } = useSongList()
  const { setSongList } = usePlayerActions()
  const { share } = useShare()
  const {
    playNext,
    playLast,
    startInstantMix,
    addToPlaylist,
    createNewPlaylist,
  } = useOptions()

  const Separator =
    variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator

  async function getSongs(): Promise<ISong[]> {
    if ('song' in album && Array.isArray(album.song)) {
      return album.song
    }
    return (await getAlbumSongs(album.id)) ?? []
  }

  async function handlePlay() {
    const songs = await getSongs()
    if (songs.length === 0) return
    setSongList(songs, 0, false, {
      id: album.id,
      name: album.name,
      type: 'album',
    })
  }

  async function handleShuffle() {
    const songs = await getSongs()
    if (songs.length === 0) return
    setSongList(songs, 0, true, {
      id: album.id,
      name: album.name,
      type: 'album',
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

  async function handleAddToPlaylist(id: string) {
    const songs = await getSongs()
    addToPlaylist(
      id,
      songs.map((song) => song.id),
    )
  }

  async function handleCreateNewPlaylist() {
    const songs = await getSongs()
    createNewPlaylist(
      album.name,
      songs.map((song) => song.id),
    )
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
          onClick={() => startInstantMix('album', album.id)}
        />

        <Separator />

        {/* Section 3: Play Next, Add to Queue */}
        <OptionsButtons.PlayNext variant={variant} onClick={handlePlayNext} />
        <OptionsButtons.PlayLast variant={variant} onClick={handlePlayLast} />

        <Separator />

        {/* Section 4: Add to Playlist (if not hidden), Share */}
        {!hidePlaylistsSection && (
          <OptionsButtons.AddToPlaylistOption variant={variant}>
            <AddToPlaylistSubMenu
              type={variant}
              newPlaylistFn={handleCreateNewPlaylist}
              addToPlaylistFn={handleAddToPlaylist}
            />
          </OptionsButtons.AddToPlaylistOption>
        )}
        <OptionsButtons.Share
          variant={variant}
          onClick={() => share(album.id)}
        />
      </DropdownMenuGroup>
    </>
  )
}
