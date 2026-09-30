import { OptionsButtons } from '@/app/components/options/buttons'
import { ContextMenuSeparator } from '@/app/components/ui/context-menu'
import { useOptions } from '@/app/hooks/use-options'
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
  const hidePlaylistsSection = useAppStore().pages.hidePlaylistsSection
  const songIndexes = [index.toString()]

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
      <OptionsButtons.InstantMix
        variant={variant}
        onClick={(e) => {
          e.stopPropagation()
          startInstantMix('song', song.id)
        }}
      />
      {!hidePlaylistsSection && (
        <>
          <ContextMenuSeparator />
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
      <ContextMenuSeparator />
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
