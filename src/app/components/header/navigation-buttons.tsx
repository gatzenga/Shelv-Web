import { AppTitle } from '@/app/components/header/app-title'

export function NavigationButtons() {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold tracking-tight text-muted-foreground select-none">
        Navidrome
      </span>
      <AppTitle />
    </div>
  )
}
