import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { SupportedLocale } from '@tabdo/types'
import { resolveLocale, DEFAULT_LOCALE } from '@tabdo/utils'
import { catalogs, viCatalog, type TranslationKey } from './catalog'
import { useAuth } from '../auth/auth-provider'

interface I18nContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: TranslationKey, fallbackOrParams?: Record<string, string | number> | string) => string
}

const defaultI18nValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: TranslationKey, params?: Record<string, string | number> | string) => {
    let text = viCatalog[key] || key
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
      })
    }
    return text
  },
}

const I18nContext = createContext<I18nContextValue>(defaultI18nValue)

const STORAGE_KEY = 'tabdo_locale'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Gracefully attempt to read profile from useAuth if inside AuthProvider
  let profileLocale: SupportedLocale | undefined
  try {
    const auth = useAuth()
    if (auth.profile?.locale) {
      profileLocale = resolveLocale(auth.profile.locale)
    }
  } catch {
    // AuthProvider not present in hierarchy, safely ignore
  }

  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return resolveLocale(stored)
    }
    return profileLocale || DEFAULT_LOCALE
  })

  // Sync with user profile once profile is loaded/updated
  useEffect(() => {
    if (profileLocale) {
      setLocaleState(profileLocale)
      try {
        localStorage.setItem(STORAGE_KEY, profileLocale)
      } catch {
        // ignore storage errors
      }
    }
  }, [profileLocale])

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    const resolved = resolveLocale(newLocale)
    setLocaleState(resolved)
    try {
      localStorage.setItem(STORAGE_KEY, resolved)
    } catch {
      // ignore storage errors
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number> | string): string => {
      const activeCatalog = catalogs[locale] || catalogs[DEFAULT_LOCALE]
      let text = activeCatalog[key] || catalogs[DEFAULT_LOCALE][key] || key

      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
        })
      }
      return text
    },
    [locale]
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
