import de from './locales/de.json'
import en from './locales/en.json'

export const resources = {
  de: { translation: de },
  en: { translation: en },
}

export const defaultLangCode = 'en'

export const languages = [
  {
    nativeName: 'Deutsch',
    langCode: 'de',
    flag: 'DE',
    dayjsLocale: 'de',
  },
  {
    nativeName: 'English',
    langCode: 'en',
    flag: 'GB',
    dayjsLocale: 'en',
  },
]

const defaultLanguage = languages[1]

// Maps any language tag (e.g. a stored "en-US" or a browser "de-CH")
// to one of the supported languages
export function findLanguage(lang: string) {
  const primary = lang.split('-')[0].toLowerCase()

  return (
    languages.find((language) => language.langCode === lang) ??
    languages.find((language) => language.langCode === primary) ??
    defaultLanguage
  )
}
