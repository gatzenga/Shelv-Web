import type { AppConfig } from '@/utils/appConfig'

export {}

declare global {
  interface Window {
    APP_CONFIG: Partial<AppConfig> | undefined
  }
}
