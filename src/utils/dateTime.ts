import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import updateLocale from 'dayjs/plugin/updateLocale'
import utc from 'dayjs/plugin/utc'

import 'dayjs/locale/de'

import i18n from '@/i18n'
import { findLanguage, languages, resources } from '@/i18n/languages'
import { appConfig } from '@/utils/appConfig'

function getDayJsLocale(langCode: string) {
  return findLanguage(langCode).dayjsLocale
}

dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(localizedFormat)

languages.forEach((lang) => {
  const langCode = lang.langCode as keyof typeof resources
  const langTranslationKeys = resources[langCode].translation

  if ('dayjs' in langTranslationKeys) {
    dayjs.updateLocale(lang.dayjsLocale, langTranslationKeys.dayjs)
  }
})

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
dayjs.tz.setDefault(browserTimezone)

dayjs.locale(getDayJsLocale(appConfig.language))

i18n.on('languageChanged', (lang: string) => {
  dayjs.locale(getDayJsLocale(lang))
})

const dateTime = dayjs
export default dateTime
