// Public-link validation only: never fetch or execute a user-supplied URL.
export function normalizeCaptureUrl(value) {
  const raw = String(value || '').trim()
  if (raw.length > 2000) throw new Error('Link is too long.')
  let url
  try { url = new URL(raw) } catch { throw new Error('Enter a valid HTTPS project URL.') }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a public HTTPS link without embedded credentials.')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
      host.includes(':') || !host.includes('.')) {
    throw new Error('Use a public website hostname, not a local or IP address.')
  }
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|msclkid$|ref$)/i.test(key)) url.searchParams.delete(key)
  }
  url.hostname = host
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  url.searchParams.sort()
  const canonical = url.toString()
  if (canonical.length > 2000) throw new Error('Link is too long.')
  return canonical
}

export function capturePlatform(url) {
  const host = new URL(url).hostname.toLowerCase()
  if (host === 'freelancer.com' || host.endsWith('.freelancer.com') ||
      /^freelancer\.[a-z.]+$/.test(host) || /\.freelancer\.[a-z.]+$/.test(host)) return 'freelancer'
  if (host === 'upwork.com' || host.endsWith('.upwork.com')) return 'upwork'
  return 'other'
}

/**
 * Presentation-only source label. Fiverr manually saved links continue to
 * use source_platform='other' until a fully reviewed backend contract exists.
 * Never infer official API verification from a domain.
 */
export function manualCaptureSourceLabel(sourceUrl, sourcePlatform = 'other') {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase()
    if (host === 'fiverr.com' || host.endsWith('.fiverr.com')) return 'Fiverr (manual)'
  } catch { /* Leave unknown URLs generic. */ }
  return sourcePlatform === 'freelancer' ? 'Freelancer'
    : sourcePlatform === 'upwork' ? 'Upwork'
      : 'Other (manual)'
}

export function validateCaptureDraft(draft = {}) {
  const source_url = normalizeCaptureUrl(draft.url)
  const title = String(draft.title || '').trim()
  const requirement = String(draft.requirement || '').trim()
  if (title.length < 4 || title.length > 180) throw new Error('Enter a project title between 4 and 180 characters.')
  if (requirement.length < 20 || requirement.length > 5000) throw new Error('Enter at least 20 characters describing the buyer request.')
  return { source_url, title, requirement, source_platform: capturePlatform(source_url) }
}
