import { useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'opportunity-dashboard-theme'
export const THEME_OPTIONS = ['system', 'light', 'dark']

export function normalizeThemePreference(value) {
  return THEME_OPTIONS.includes(value) ? value : 'system'
}

export function resolveTheme(preference, prefersDark) {
  const selected = normalizeThemePreference(preference)
  return selected === 'system' ? (prefersDark ? 'dark' : 'light') : selected
}

function readPreference() {
  try { return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY)) }
  catch { return 'system' }
}

function applyTheme(preference, prefersDark) {
  const theme = resolveTheme(preference, prefersDark)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

/** Defaults to OS/browser preference and follows its changes until overridden. */
export function useThemePreference() {
  const [preference, setPreference] = useState(readPreference)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const refresh = () => applyTheme(preference, Boolean(media?.matches))
    refresh()
    if (preference === 'system') {
      media?.addEventListener?.('change', refresh)
    }
    const syncTabs = event => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreference(readPreference())
      }
    }
    window.addEventListener('storage', syncTabs)
    return () => {
      media?.removeEventListener?.('change', refresh)
      window.removeEventListener('storage', syncTabs)
    }
  }, [preference])

  const changePreference = next => {
    const nextPreference = normalizeThemePreference(next)
    setPreference(nextPreference)
    // Update immediately; React effect will attach system listener if needed.
    applyTheme(nextPreference, Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches))
    try {
      if (nextPreference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
      else window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
    } catch { /* A blocked storage API should not block manual theme switching. */ }
  }

  return { preference, setPreference: changePreference }
}
