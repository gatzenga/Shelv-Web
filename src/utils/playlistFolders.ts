import { Playlist } from '@/types/responses/playlist'

export interface PlaylistFolderNode {
  type: 'folder'
  // the path, e.g. "Rock/Classic Rock"
  id: string
  name: string
  // all playlists below this folder, also those in sub folders
  count: number
  children: PlaylistNode[]
}

export interface PlaylistLeafNode {
  type: 'playlist'
  playlist: Playlist
  // the last part of the name
  title: string
}

export type PlaylistNode = PlaylistFolderNode | PlaylistLeafNode

// Like in the Shelv app: a "/" in the name of a playlist makes folders,
// "Rock/Classic Rock/Favorites" is the playlist Favorites in the folder
// Classic Rock in the folder Rock
export function buildPlaylistTree(playlists: Playlist[]) {
  const root: PlaylistNode[] = []
  const folders = new Map<string, PlaylistFolderNode>()

  for (const playlist of playlists) {
    const parts = playlist.name
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length === 0) parts.push(playlist.name)

    let siblings = root
    let path = ''

    for (const name of parts.slice(0, -1)) {
      path = path ? `${path}/${name}` : name

      let folder = folders.get(path)
      if (!folder) {
        folder = { type: 'folder', id: path, name, count: 0, children: [] }
        folders.set(path, folder)
        siblings.push(folder)
      }

      folder.count += 1
      siblings = folder.children
    }

    siblings.push({
      type: 'playlist',
      playlist,
      title: parts[parts.length - 1],
    })
  }

  return root
}
