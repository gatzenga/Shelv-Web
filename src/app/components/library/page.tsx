import { ReactNode } from 'react'
import { ScrollArea } from '@/app/components/ui/scroll-area'

interface LibraryPageProps {
  // Stay in place: the title row and the toolbar
  header: ReactNode
  children: ReactNode
}

// A list page of the Library. The header and the toolbar stay fixed, only the
// list scrolls, so the scrollbar starts where the list does.
export function LibraryPage({ header, children }: LibraryPageProps) {
  return (
    <div className="flex h-content w-full flex-col">
      <div className="shrink-0">{header}</div>
      <ScrollArea data-page-scroll className="min-h-0 flex-1">
        {children}
      </ScrollArea>
    </div>
  )
}
