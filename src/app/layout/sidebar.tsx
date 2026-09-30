import {
  HeartIcon,
  LibraryIcon,
  Mic2Icon,
  RadioIcon,
  SparklesIcon,
  TagsIcon,
} from 'lucide-react'
import { ElementType, memo } from 'react'
import { ROUTES } from '@/routes/routesList'

const Mic2 = memo(Mic2Icon)
const Radio = memo(RadioIcon)
const Discover = memo(SparklesIcon)
const Library = memo(LibraryIcon)
const Heart = memo(HeartIcon)
const Tags = memo(TagsIcon)

export interface ISidebarItem {
  id: string
  title: string
  route: string
  icon: ElementType
}

export enum SidebarItems {
  Home = 'home',
  Albums = 'albums',
  Artists = 'artists',
  Genres = 'genres',
  Favorites = 'favorites',
  Playlists = 'playlists',
  Radios = 'radios',
}

export const mainNavItems = [
  {
    id: SidebarItems.Home,
    title: 'sidebar.home',
    route: ROUTES.LIBRARY.HOME,
    icon: Discover,
  },
]

export const libraryItems = [
  {
    id: SidebarItems.Albums,
    title: 'sidebar.albums',
    route: ROUTES.LIBRARY.ALBUMS,
    icon: Library,
  },
  {
    id: SidebarItems.Artists,
    title: 'sidebar.artists',
    route: ROUTES.LIBRARY.ARTISTS,
    icon: Mic2,
  },
  {
    id: SidebarItems.Genres,
    title: 'sidebar.genres',
    route: ROUTES.LIBRARY.GENRES,
    icon: Tags,
  },
  {
    id: SidebarItems.Favorites,
    title: 'sidebar.favorites',
    route: ROUTES.LIBRARY.FAVORITES,
    icon: Heart,
  },
  {
    id: SidebarItems.Radios,
    title: 'sidebar.radios',
    route: ROUTES.LIBRARY.RADIOS,
    icon: Radio,
  },
]
