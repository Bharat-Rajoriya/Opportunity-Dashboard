import { useEffect, useRef } from 'react'

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script'
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  const existing = document.getElementById(TURNSTILE_SCRIPT_ID)

  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener(
        'load',
        () => resolve(window.turnstile),
        { once: true }
      )
      existing.addEventListener(
        'error',
        () => reject(new Error('Unable to load security challenge.')),
        { once: true }
      )
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true

    script.addEventListener(
      'load',
      () => resolve(window.turnstile),
      { once: true }
    )

    script.addEventListener(
      'error',
      () => reject(new Error('Unable to load security challenge.')),
      { once: true }
    )

    document.head.appendChild(script)
  })
}

export default function TurnstileCaptcha({
  siteKey,
  resetKey,
  onTokenChange,
}) {
  const containerRef = useRef(null)
  const onTokenChangeRef = useRef(onTokenChange)

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange
  }, [onTokenChange])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined

    let cancelled = false
    let widgetId = null

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !turnstile || !containerRef.current) return

        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token) => {
            onTokenChangeRef.current?.(token || '')
          },
          'expired-callback': () => {
            onTokenChangeRef.current?.('')
          },
          'error-callback': () => {
            onTokenChangeRef.current?.('')
            return true
          },
        })
      })
      .catch(() => {
        if (!cancelled) onTokenChangeRef.current?.('')
      })

    return () => {
      cancelled = true

      if (
        widgetId !== null &&
        window.turnstile?.remove
      ) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // Widget may already have been removed by Turnstile.
        }
      }
    }
  }, [siteKey, resetKey])

  if (!siteKey) return null

  return (
    <div
      className="flex min-h-16 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
      aria-label="Security verification"
    >
      <div ref={containerRef} />
    </div>
  )
}
