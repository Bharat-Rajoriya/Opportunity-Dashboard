/**
 * The market checkboxes represent preferences, not an exclusive country filter.
 * Preserve other selected values when toggling one choice.
 */
export const SEARCH_COUNTRIES = Object.freeze([
  'USA', 'UK', 'UAE', 'Australia', 'India',
])

function normalizeMarkets(values) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  return values.filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => {
      const key = item.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function toggleTargetMarket(current, country, checked) {
  const existing = normalizeMarkets(current)
  if (!SEARCH_COUNTRIES.includes(country)) return existing
  const isSelected = existing.some(item => item.toLowerCase() === country.toLowerCase())
  if (checked && !isSelected) return [...existing, country]
  if (!checked) return existing.filter(item => item.toLowerCase() !== country.toLowerCase())
  return existing
}

export function hasUnsavedTargetMarkets(current, saved) {
  const list = values => normalizeMarkets(values)
    .map(item => item.toLowerCase()).sort()
  return JSON.stringify(list(current)) !== JSON.stringify(list(saved))
}
