import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLang } from '@/store/lang.store'
import { appConfig } from '@/utils/appConfig'

export function LangObserver() {
  const { i18n } = useTranslation()
  const { langCode, setLang } = useLang()

  const setLangOnHtml = useCallback((lang: string) => {
    const root = window.document.documentElement
    root.removeAttribute('lang')
    root.setAttribute('lang', lang)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: initial only useEffect
  useEffect(() => {
    setLang(appConfig.language)
  }, [])

  useEffect(() => {
    if (langCode) {
      i18n.changeLanguage(langCode)
      setLangOnHtml(langCode)
    }
  }, [i18n, langCode, setLangOnHtml])

  return null
}
