import { ReactNode } from 'react'

interface SimpleTooltipProps {
  children: ReactNode
  text?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'center' | 'end' | 'start'
  delay?: number
  avoidCollisions?: boolean
  disabled?: boolean
}

// Tooltips are switched off in the whole app, the wrapper only keeps the
// call sites working
export function SimpleTooltip({ children }: SimpleTooltipProps) {
  return <>{children}</>
}
