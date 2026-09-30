import clsx from 'clsx'
import { Skeleton } from '@/app/components/ui/skeleton'

interface TableFallbackProps {
  variant?: 'classic' | 'modern'
  type?: 'regular' | 'infinity'
  length?: number
}

export function TableFallback({
  variant = 'classic',
  type = 'regular',
  length = 10,
}: TableFallbackProps) {
  const isClassic = variant === 'classic'
  const isModern = variant === 'modern'
  const isRegular = type === 'regular'

  return (
    <div
      className={clsx(
        'w-full rounded-md',
        isClassic && 'bg-background border',
        isModern && 'bg-transparent',
      )}
    >
      <div
        className={clsx(
          'grid grid-cols-table-fallback px-2 items-center',
          isModern && 'border-b',
          isModern && isRegular && 'mb-2',
          isRegular ? 'h-12' : 'h-[41px]',
        )}
      >
        <Skeleton className="w-5 h-5 ml-2" />
        <Skeleton className="w-8 h-5" />
        <Skeleton className="w-16 h-5" />
        <Skeleton className="w-16 h-5" />
        <Skeleton className="w-12 h-5" />
        <Skeleton className="w-16 h-5" />
        <Skeleton className="w-12 h-5" />
        <Skeleton className="w-5 h-5 ml-auto mr-2" />
      </div>
      {Array.from({ length }).map((_, index) => (
        <div
          key={index}
          className={clsx(
            'grid grid-cols-table-fallback p-2 items-center',
            isClassic && 'border-t',
          )}
        >
          <Skeleton className="w-5 h-5 ml-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-10 h-10" />
            <Skeleton className="w-36 h-5" />
          </div>
          <Skeleton className="w-36 h-5" />
          <Skeleton className="w-12 h-5" />
          <Skeleton className="w-6 h-5" />
          <Skeleton className="w-20 h-5" />
          <Skeleton className="w-14 h-5 rounded-full" />
          <div className="flex items-center justify-end gap-4 w-full">
            <Skeleton className="w-5 h-5 mr-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TopSongsTableFallback() {
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="w-32 h-7 rounded" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-5 h-5" />
              <Skeleton className="w-11 h-11 rounded-md shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="w-3/4 h-4" />
                <Skeleton className="w-1/2 h-3" />
              </div>
              <Skeleton className="w-10 h-4" />
              <Skeleton className="w-6 h-6 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-5 h-5" />
              <Skeleton className="w-11 h-11 rounded-md shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="w-3/4 h-4" />
                <Skeleton className="w-1/2 h-3" />
              </div>
              <Skeleton className="w-10 h-4" />
              <Skeleton className="w-6 h-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
