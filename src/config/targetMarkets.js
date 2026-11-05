/**
 * Normalize legacy target markets on read and write, while preserving
 * additional markets previously saved outside the five quick-select options.
 * The production database may contain "usa", "uk", "uae", "india", "Australia".
 */
export const SEARCH_COUNTRIES = Object.freeze([
  'USA', 'UK', 'UAE', 'Australia', 'India',
])

const ALIASES = new Map([
  ['usa', 'USA'], ['us', 'USA'], ['u.s.', 'USA'],
  ['united states', 'USA'], ['united states of america', 'USA'],
  ['uk', 'UK'], ['u.k.', 'UK'], ['united kingdom', 'UK'],
  ['uae', 'UAE'], ['u.a.e.', 'UAE'], ['united arab emirates', 'UAE'],
  ['australia', 'Australia'],
  ['india', 'India'],
])

const canonical = value => {
  const trimmed = String(value || '').trim()
  return ALIASES.get(trimmed.toLowerCase()) || trimmed
}

export function normalizeTargetMarkets(values) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  const result = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const raw = value.trim()
    if (!raw) continue
    const parts = raw.split(/[,;]/).map(item => item.trim()).filter(Boolean)
    // Split old "USA, UK, UAE" entries, but don't split unrecognized free text.
    const entries = parts.length > 1 && parts.every(item => ALIASES.has(item.toLowerCase()))
      ? parts : [raw]
    for (const entry of entries) {
      const name = canonical(entry)
      const key = name.toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(name)
    }
  }
  return result
}

export function isTargetMarketSelected(values, country) {
  const selected = canonical(country)
  return normalizeTargetMarkets(values).some(item => item.toLowerCase() === selected.toLowerCase())
}

export function toggleTargetMarket(current, country, checked) {
  const existing = normalizeTargetMarkets(current)
  if (!SEARCH_COUNTRIES.includes(country)) return existing
  const isSelected = isTargetMarketSelected(existing, country)
  if (checked && !isSelected) return [...existing, country]
  if (!checked) return existing.filter(item => item.toLowerCase() !== country.toLowerCase())
  return existing
}

export function hasUnsavedTargetMarkets(current, saved) {
  const list = values => normalizeTargetMarkets(values)
    .map(item => item.toLowerCase()).sort()
  return JSON.stringify(list(current)) !== JSON.stringify(list(saved))
}
