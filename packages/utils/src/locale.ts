import type { SupportedLocale } from '@tabdo/types'

export const DEFAULT_LOCALE: SupportedLocale = 'vi'
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['vi', 'en'] as const

export function isValidLocale(locale: unknown): locale is SupportedLocale {
  return typeof locale === 'string' && (locale === 'vi' || locale === 'en')
}

export function resolveLocale(candidate?: unknown, fallback: SupportedLocale = DEFAULT_LOCALE): SupportedLocale {
  if (isValidLocale(candidate)) return candidate
  return fallback
}
