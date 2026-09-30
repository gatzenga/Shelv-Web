import { AppTitle } from '@/app/components/header/app-title'

export function NavigationButtons() {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold tracking-tight text-muted-foreground select-none">
        Navidrome
      </span>
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <AppTitle />
    </div>
  )
}
