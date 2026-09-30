import { OptionsButtons } from '@/app/components/options/buttons'
import { ContextMenuSeparator } from '@/app/components/ui/context-menu'
import { DropdownMenuSeparator } from '@/app/components/ui/dropdown-menu'
import { useOptions } from '@/app/hooks/use-options'
import { useShare } from '@/app/hooks/use-share'
import { useAppStore } from '@/store/app.store'
import { ISong } from '@/types/responses/song'
import { AddToPlaylistSubMenu } from './add-to-playlist'

interface SongMenuOptionsProps {
  variant: 'context' | 'dropdown'
  song: ISong
  index: number
}

export function SongMenuOptions({
  variant,
  song,
  index,
}: SongMenuOptionsProps) {
  const {
    playNext,
    playLast,
    startInstantMix,
    createNewPlaylist,
    addToPlaylist,
    removeSongFromPlaylist,
    openSongInfo,
    isOnPlaylistPage,
  } = useOptions()
  const { share } = useShare()
  const hidePlaylistsSection = useAppStore().pages.hidePlaylistsSection
  const songIndexes = [index.toString()]

  const Separator =
    variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator

  return (
    <>
      <OptionsButtons.PlayNext
        variant={variant}
        onClick={(e) => {
          e.stopPropagation()
          playNext([song])
        }}
      />
      <OptionsButtons.PlayLast
        variant={variant}
        onClick={(e) => {
          e.stopPropagation()
          playLast([song])
        }}
      />

      <Separator />

      <OptionsButtons.InstantMix
        variant={variant}
        onClick={(e) => {
          e.stopPropagation()
          startInstantMix('song', song.id)
        }}
      />

      {!hidePlaylistsSection && (
        <>
          <Separator />
          <OptionsButtons.AddToPlaylistOption variant={variant}>
            <AddToPlaylistSubMenu
              type={variant}
              newPlaylistFn={() => createNewPlaylist(song.title, song.id)}
              addToPlaylistFn={(id) => addToPlaylist(id, song.id)}
            />
          </OptionsButtons.AddToPlaylistOption>
        </>
      )}
      {isOnPlaylistPage && (
        <OptionsButtons.RemoveFromPlaylist
          variant={variant}
          onClick={(e) => {
            e.stopPropagation()
            removeSongFromPlaylist(songIndexes)
          }}
        />
      )}

      <Separator />

      <OptionsButtons.Share
        variant={variant}
        onClick={(e) => {
          e.stopPropagation()
          share(song.id)
        }}
      />
      <OptionsButtons.SongInfo
        variant={variant}
        onClick={(e) => {
          e.stopPropagation()
          openSongInfo(song.id)
        }}
      />
    </>
  )
}
