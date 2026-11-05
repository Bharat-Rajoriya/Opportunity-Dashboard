import { useModalFocus } from '../hooks/useModalFocus'

/**
 * Applies modal focus/scroll behavior to existing settings drawers.
 * Child panel keeps the semantic dialog title and save handlers.
 */
export default function ModalFocusScope({ className, onClose, initialFocusSelector, children }) {
  const modalRef = useModalFocus(onClose, { initialFocusSelector })
  return (
    <div ref={modalRef} className={className} role="presentation" tabIndex={-1}>
      {children}
    </div>
  )
}
