import { Cell, flexRender, Row } from '@tanstack/react-table'
import clsx from 'clsx'
import {
  DragEvent,
  MouseEvent,
  memo,
  TouchEvent,
  useMemo,
  useState,
} from 'react'
import { ContextMenuProvider } from '@/app/components/table/context-menu'
import { usePlayerCurrentSong } from '@/store/player.store'
import { ColumnDefType } from '@/types/react-table/columnDef'

const MemoContextMenuProvider = memo(ContextMenuProvider)
const MemoTableCell = memo(TableCell) as typeof TableCell

interface TableRowProps<TData> {
  row: Row<TData>
  virtualRow: { index: number; size: number; start: number }
  handleClicks: (e: MouseEvent<HTMLDivElement>, row: Row<TData>) => void
  handleRowDbClick: (e: MouseEvent<HTMLDivElement>, row: Row<TData>) => void
  handleRowTap: (e: TouchEvent<HTMLDivElement>, row: Row<TData>) => void
  getContextMenuOptions: (row: Row<TData>) => JSX.Element | undefined
  dataType?: 'song' | 'artist' | 'playlist' | 'radio'
  pageType?: 'general' | 'queue'
  onRowMove?: (from: number, to: number) => void
}

let isTap = false
// index of the row being dragged, shared by all rows of the list
let dragIndex: number | null = null
let tapTimeout: NodeJS.Timeout

export function TableListRow<TData>({
  row,
  virtualRow,
  handleClicks,
  handleRowDbClick,
  handleRowTap,
  getContextMenuOptions,
  dataType = 'song',
  pageType = 'general',
  onRowMove,
}: TableRowProps<TData>) {
  const currentSong = usePlayerCurrentSong()
  const [dropSide, setDropSide] = useState<'top' | 'bottom' | null>(null)
  const index = virtualRow.index

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    dragIndex = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (dragIndex === null || dragIndex === index) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // the song lands after this row when dragged down, before it when dragged up
    setDropSide(dragIndex < index ? 'bottom' : 'top')
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDropSide(null)
    if (dragIndex !== null && dragIndex !== index) onRowMove?.(dragIndex, index)
    dragIndex = null
  }

  function handleDragEnd() {
    dragIndex = null
    setDropSide(null)
  }

  function handleTouchStart() {
    isTap = true
    tapTimeout = setTimeout(() => {
      isTap = false
    }, 500)
  }

  function handleTouchMove() {
    isTap = false
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    clearTimeout(tapTimeout)
    if (isTap) handleRowTap(e, row)
  }

  function handleTouchCancel() {
    clearTimeout(tapTimeout)
    isTap = false
  }

  const isRowSongActive = useMemo(() => {
    if (dataType !== 'song') return false

    // @ts-expect-error row type
    return row.original.id === currentSong.id
  }, [currentSong.id, dataType, row.original])

  const isQueue = pageType === 'queue'

  return (
    <MemoContextMenuProvider options={getContextMenuOptions(row)}>
      <div
        role="row"
        data-test-id="table-row"
        data-row-index={virtualRow.index}
        data-state={row.getIsSelected() && 'selected'}
        onClick={(e) => handleClicks(e, row)}
        onDoubleClick={(e) => handleRowDbClick(e, row)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onContextMenu={(e) => handleClicks(e, row)}
        draggable={onRowMove !== undefined}
        onDragStart={onRowMove ? handleDragStart : undefined}
        onDragOver={onRowMove ? handleDragOver : undefined}
        onDragLeave={onRowMove ? () => setDropSide(null) : undefined}
        onDrop={onRowMove ? handleDrop : undefined}
        onDragEnd={onRowMove ? handleDragEnd : undefined}
        className={clsx(
          'group/tablerow w-[calc(100%-10px)] flex flex-row transition-colors',
          'data-[state=selected]:bg-foreground/30 hover:bg-foreground/20',
          isQueue && 'rounded-md',
          isRowSongActive && 'row-active bg-foreground/20',
          dropSide === 'top' && 'shadow-[inset_0_2px_0_0_hsl(var(--primary))]',
          dropSide === 'bottom' &&
            'shadow-[inset_0_-2px_0_0_hsl(var(--primary))]',
        )}
        style={{
          height: `${virtualRow.size}px`,
          position: 'absolute',
          top: virtualRow.start,
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <MemoTableCell key={cell.id} cell={cell} />
        ))}
      </div>
    </MemoContextMenuProvider>
  )
}

interface TableCellProps<TData, TValue> {
  cell: Cell<TData, TValue>
}

function TableCell<TData, TValue>({ cell }: TableCellProps<TData, TValue>) {
  const columnDef = cell.column.columnDef as ColumnDefType<TData>

  return (
    <div
      key={cell.id}
      className={clsx(
        'p-2 flex flex-row items-center justify-start [&:has([role=checkbox])]:pr-4',
        columnDef.className,
      )}
      style={columnDef.style}
      role="cell"
    >
      {flexRender(columnDef.cell, cell.getContext())}
    </div>
  )
}
