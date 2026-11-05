import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

let activeLocks = 0
let previousOverflow = ''

/**
 * Keep keyboard focus in an open drawer/dialog, restore it on close, and
 * prevent background scrolling. React components only mount this when open.
 */
export function useModalFocus(onClose, { active = true, initialFocusSelector = '' } = {}) {
  const modalRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const modal = modalRef.current
    if (!active || !modal) return undefined

    const previousFocus = document.activeElement
    if (activeLocks === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    activeLocks += 1

    const focusableElements = () => Array.from(modal.querySelectorAll(FOCUSABLE))
      .filter(node => node.getClientRects().length > 0 && node.getAttribute('aria-hidden') !== 'true')

    const firstFocus = initialFocusSelector
      ? modal.querySelector(initialFocusSelector) : null
    const initial = firstFocus || focusableElements()[0] || modal
    initial.focus({ preventScroll: true })

    const onKeyDown = event => {
      // Nested follow-up calendar owns Escape while its day picker is open.
      if (event.key === 'Escape') {
        if (modal.querySelector('[role="dialog"][aria-label="Choose follow-up date"]')) return
        event.preventDefault()
        closeRef.current?.()
        return
      }

      if (event.key !== 'Tab') return

      const items = focusableElements()
      if (!items.length) {
        event.preventDefault()
        modal.focus({ preventScroll: true })
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const focused = document.activeElement
      if (!modal.contains(focused)) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      } else if (event.shiftKey && focused === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      activeLocks = Math.max(0, activeLocks - 1)
      if (activeLocks === 0) document.body.style.overflow = previousOverflow
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [active, initialFocusSelector])

  return modalRef
}
