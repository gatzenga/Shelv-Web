import { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type MainGridProps = ComponentPropsWithoutRef<'div'>

export function MainGrid({ className, ...props }: MainGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 h-full',
        className,
      )}
      {...props}
    />
  )
}
