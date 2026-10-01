export interface IServerConfig {
  url: string
  username: string
  password: string
  protocolVersion?: string
  serverType?: string
  extensionsSupported?: Record<string, number[]>
}

export type PageViewType = 'grid' | 'table'

interface IAppPages {
  hideArtistsSection: boolean
  hideAlbumsSection: boolean
  hideGenresSection: boolean
  hideFavoritesSection: boolean
  hidePlaylistsSection: boolean
  hideRadiosSection: boolean
  artistsPageViewType: PageViewType
  setArtistsPageViewType: (type: PageViewType) => void
}

// The password is only typed into the login form, it is never kept
export interface IAppData extends Omit<IServerConfig, 'password'> {
  isServerConfigured: boolean
  osType: string
  logoutDialogState: boolean
  songCount: number | null
}

export interface IAppActions {
  setOsType: (value: string) => void
  setUrl: (value: string) => void
  setUsername: (value: string) => void
  saveConfig: (data: IServerConfig) => Promise<boolean>
  removeConfig: () => void
  setLogoutDialogState: (value: boolean) => void
}

export interface IAppContext {
  data: IAppData
  pages: IAppPages
  actions: IAppActions
}
