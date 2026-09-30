import { AppIcon } from '@/app/components/app-icon'

export function AppTitle() {
  return (
    <div className="flex gap-2 items-center">
      <AppIcon size={24} />
      <span className="leading-7 text-sm font-bold text-muted-foreground">
        Shelv
      </span>
    </div>
  )
}
