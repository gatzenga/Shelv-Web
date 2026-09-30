import { memo } from 'react'
import { Link } from 'react-router-dom'
import { CoverImage } from '@/app/components/table/cover-image'
import { TableLikeButton } from '@/app/components/table/like-button'
import PlaySongButton from '@/app/components/table/play-button'
import { DataTableColumnHeader } from '@/app/components/ui/data-table-column-header'
import i18n from '@/i18n'
import { ROUTES } from '@/routes/routesList'
import { useAppStore } from '@/store/app.store'
import { ColumnDefType } from '@/types/react-table/columnDef'
import { Albums } from '@/types/responses/album'

const MemoPlaySongButton = memo(PlaySongButton)
const MemoDataTableColumnHeader = memo(
  DataTableColumnHeader,
) as typeof DataTableColumnHeader
const MemoTableLikeButton = memo(TableLikeButton)

export function albumsColumns(): ColumnDefType<Albums>[] {
  const hideFavoritesSection = useAppStore().pages.hideFavoritesSection

  return [
    {
      id: 'index',
      accessorKey: 'index',
      style: {
        width: 48,
        minWidth: '48px',
      },
      header: () => {
        return <div className="w-full text-center">#</div>
      },
      cell: ({ row, table }) => (
        <MemoPlaySongButton
          trackNumber={row.index + 1}
          trackId={row.original.id}
          handlePlayButton={() => table.options.meta?.handlePlaySong?.(row)}
        />
      ),
    },
    {
      id: 'name',
      accessorKey: 'name',
      enableSorting: false,
      style: {
        flex: 1,
        minWidth: 100,
      },
      header: ({ column, table }) => (
        <MemoDataTableColumnHeader column={column} table={table}>
          {i18n.t('table.columns.name')}
        </MemoDataTableColumnHeader>
      ),
      cell: ({ row }) => (
        <div className="flex gap-2 items-center min-w-[200px] 2xl:min-w-[350px]">
          <CoverImage
            coverArt={row.original.coverArt}
            coverArtType="album"
            altText={row.original.name}
          />
          <Link
            to={ROUTES.ALBUM.PAGE(row.original.id)}
            className="hover:underline truncate"
          >
            {row.original.name}
          </Link>
        </div>
      ),
    },
    {
      id: 'artist',
      accessorKey: 'artist',
      enableSorting: false,
      style: {
        width: '25%',
        maxWidth: '25%',
      },
      header: ({ column, table }) => (
        <MemoDataTableColumnHeader column={column} table={table}>
          {i18n.t('table.columns.artist')}
        </MemoDataTableColumnHeader>
      ),
      cell: ({ row }) => {
        const { artist, artistId } = row.original

        if (!artistId) return <span className="truncate">{artist}</span>

        return (
          <Link
            to={ROUTES.ARTIST.PAGE(artistId)}
            className="hover:underline truncate text-foreground/70 hover:text-foreground"
          >
            {artist}
          </Link>
        )
      },
    },
    {
      id: 'year',
      accessorKey: 'year',
      enableSorting: false,
      style: {
        width: '10%',
        maxWidth: '10%',
      },
      header: ({ column, table }) => (
        <MemoDataTableColumnHeader column={column} table={table}>
          {i18n.t('table.columns.year')}
        </MemoDataTableColumnHeader>
      ),
    },
    {
      id: 'songCount',
      accessorKey: 'songCount',
      enableSorting: false,
      style: {
        width: '12%',
        maxWidth: '12%',
      },
      header: ({ column, table }) => (
        <MemoDataTableColumnHeader column={column} table={table}>
          {i18n.t('table.columns.songCount')}
        </MemoDataTableColumnHeader>
      ),
    },
    {
      id: 'starred',
      accessorKey: 'starred',
      header: '',
      style: { width: 48, maxWidth: 48 },
      cell: ({ row }) => {
        const { starred, id } = row.original

        if (hideFavoritesSection) return null

        return (
          <MemoTableLikeButton
            type="album"
            entityId={id}
            starred={typeof starred === 'string'}
          />
        )
      },
    },
  ]
}
