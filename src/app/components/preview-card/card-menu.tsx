import { useQuery } from '@tanstack/react-query'
import { Loader2, MoreHorizontalIcon } from 'lucide-react'
import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlbumOptions } from '@/app/components/album/options'
import { ArtistOptions } from '@/app/components/artist/options'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { subsonic } from '@/service/subsonic'
import { queryKeys } from '@/utils/queryKeys'

function CardMenu({ children }: { children: (open: boolean) => ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          aria-label={t('generic.options')}
          data-testid="card-menu-button"
        >
          <MoreHorizontalIcon className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {children(open)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LoadingItem() {
  return (
    <DropdownMenuItem disabled>
      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
    </DropdownMenuItem>
  )
}

// The album options need the song list, it is loaded when the menu opens
function AlbumMenuContent({ albumId }: { albumId: string }) {
  const { data: album } = useQuery({
    queryKey: [queryKeys.album.single, albumId],
    queryFn: () => subsonic.albums.getOne(albumId),
  })

  if (!album) return <LoadingItem />

  return <AlbumOptions album={album} />
}

export function AlbumCardMenu({ albumId }: { albumId: string }) {
  return (
    <CardMenu>
      {(open) => (open ? <AlbumMenuContent albumId={albumId} /> : null)}
    </CardMenu>
  )
}

export function ArtistCardMenu({ id, name }: { id: string; name: string }) {
  return (
    <CardMenu>
      {(open) => (open ? <ArtistOptions artist={{ id, name }} /> : null)}
    </CardMenu>
  )
}
