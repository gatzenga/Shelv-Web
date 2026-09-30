import { useGrid, useVirtualizer } from '@virtual-grid/react'
import {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  GridViewWrapperType,
  getGridClickedItem,
  saveGridClickedItem,
} from '@/utils/gridTools'
import { getMainScrollElement } from '@/utils/scrollPageToTop'

type GridViewWrapperProps<T> = {
  list: T[]
  children: (child: T) => ReactNode
  titleHeight?: number
  gap?: number
  padding?: number
  defaultWidth?: number
  type: GridViewWrapperType
}

export function GridViewWrapper<T>({
  list,
  children,
  titleHeight = 40,
  gap = 16,
  padding = 32,
  defaultWidth = 132,
  type,
}: GridViewWrapperProps<T>) {
  const scrollDivRef = useRef<HTMLDivElement | null>(null)
  const [gridColumnsSize, setGridColumnsSize] = useState(4)
  const [size, setSize] = useState({
    width: defaultWidth,
    height: defaultWidth + titleHeight,
  })
  const initialScrollRestored = useRef(false)
  const isScrollingSaved = useRef(false)
  const initialMeasurementDone = useRef(false)

  const routeKey = location.pathname + location.search

  const rows = useMemo(
    () => Math.ceil(list.length / gridColumnsSize),
    [gridColumnsSize, list.length],
  )

  const updateGridDimensions = useCallback(() => {
    const scrollEl = scrollDivRef.current || getMainScrollElement()
    if (!scrollEl) return
    scrollDivRef.current = scrollEl

    const pageWidth = scrollEl.clientWidth || scrollEl.offsetWidth
    if (!pageWidth) return

    const bothSidesPaddingSize = padding * 2
    const availableWidth = Math.max(0, pageWidth - bothSidesPaddingSize)
    const targetWidth = defaultWidth || 132

    const newColumns = Math.max(
      1,
      Math.floor((availableWidth + gap) / (targetWidth + gap)),
    )

    const gapsDifference = (newColumns - 1) * gap
    const remainSpace = Math.max(0, availableWidth - gapsDifference)

    const width = remainSpace / newColumns
    const height = width + titleHeight

    setGridColumnsSize((prev) => (prev !== newColumns ? newColumns : prev))
    setSize((prev) => {
      if (
        Math.abs(prev.width - width) < 0.5 &&
        Math.abs(prev.height - height) < 0.5
      ) {
        return prev
      }
      return { width, height }
    })
  }, [defaultWidth, gap, padding, titleHeight])

  useLayoutEffect(() => {
    const scrollEl = getMainScrollElement()
    scrollDivRef.current = scrollEl

    updateGridDimensions()

    let animationFrameId: number

    const resizeHandler = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      animationFrameId = requestAnimationFrame(updateGridDimensions)
    }

    window.addEventListener('resize', resizeHandler)

    const resizeObserver = new ResizeObserver(resizeHandler)

    if (scrollEl) {
      resizeObserver.observe(scrollEl)
    }

    return () => {
      window.removeEventListener('resize', resizeHandler)
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
    }
  }, [updateGridDimensions])

  const grid = useGrid({
    scrollRef: scrollDivRef,
    count: list.length,
    totalCount: list.length,
    columns: gridColumnsSize,
    rows,
    size,
    padding: {
      x: padding,
    },
    gap,
    overscan: 5,
  })

  const rowVirtualizer = useVirtualizer(grid.rowVirtualizer)
  const columnVirtualizer = useVirtualizer(grid.columnVirtualizer)

  // biome-ignore lint/correctness/useExhaustiveDependencies: initial grid measurement
  useLayoutEffect(() => {
    rowVirtualizer.measure()
    columnVirtualizer.measure()

    initialMeasurementDone.current = true
  }, [
    rowVirtualizer,
    columnVirtualizer,
    grid.virtualItemHeight,
    grid.virtualItemWidth,
    gridColumnsSize,
  ])

  // Restoring scroll position
  useLayoutEffect(() => {
    // Awaits initial measurement before restoring
    if (!initialMeasurementDone.current || initialScrollRestored.current) return

    const savedRowPosition = getGridClickedItem({ name: type })
    if (!savedRowPosition) {
      initialScrollRestored.current = true
      return
    }

    const offsetTop = savedRowPosition[routeKey] ?? 0
    if (offsetTop <= 0) {
      initialScrollRestored.current = true
      return
    }

    // 50ms timeout to ensure the grid was rendered
    setTimeout(() => {
      rowVirtualizer.scrollToOffset(offsetTop)
      initialScrollRestored.current = true

      // 100ms timeout to allow saving scroll position again avoiding saving wrong offsets
      setTimeout(() => {
        isScrollingSaved.current = false
      }, 100)
    }, 50)

    // Prevent scroll saves while restoring the scroll
    isScrollingSaved.current = true
  }, [routeKey, rowVirtualizer, type])

  // Saving scroll position
  useEffect(() => {
    if (isScrollingSaved.current || !initialScrollRestored.current || !routeKey)
      return

    const offsetTop = rowVirtualizer.scrollOffset ?? 0
    if (offsetTop <= 0) return

    saveGridClickedItem({
      name: type,
      offsetTop,
      routeKey,
    })
  }, [routeKey, rowVirtualizer.scrollOffset, type])

  return (
    <div
      style={{
        width: columnVirtualizer.getTotalSize(),
        height: rowVirtualizer.getTotalSize(),
        position: 'relative',
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <Fragment key={virtualRow.key}>
          {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
            const item = grid.getVirtualItem({
              row: virtualRow,
              column: virtualColumn,
            })

            if (!item) return null

            const child = list[item.index]

            return (
              <div key={virtualColumn.key} style={item.style}>
                {children(child)}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
