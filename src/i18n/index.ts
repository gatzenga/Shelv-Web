import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { appConfig } from '@/utils/appConfig'
import { isDev } from '@/utils/env'
import { defaultLangCode, resources } from './languages'

i18n.use(initReactI18next).init({
  debug: isDev,
  // set with LANGUAGE in the docker environment
  lng: appConfig.language,
  fallbackLng: defaultLangCode,
  supportedLngs: Object.keys(resources),
  nonExplicitSupportedLngs: true,
  interpolation: {
    escapeValue: false,
  },
  resources,
})

export default i18n
