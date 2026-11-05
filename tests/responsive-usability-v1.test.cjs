const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const read = path => readFileSync(join(__dirname, '../src', path), 'utf8')
const app = read('App.jsx')
const hook = read('hooks/useModalFocus.js')
const scope = read('components/ModalFocusScope.jsx')
const css = read('responsive-a11y.css')

test('all four existing dialogs use a reusable focus scope or active focus hook', () => {
  assert.equal((app.match(/<ModalFocusScope/g) || []).length, 4)
  assert.equal((app.match(/<\/ModalFocusScope>/g) || []).length, 4)
  assert(app.includes('useModalFocus(onClose, { active: Boolean(opportunity) })'))
  assert(app.includes('ref={dialogRef} role="dialog"'))
  assert(scope.includes('useModalFocus(onClose, { initialFocusSelector })'))
})

test('dialogs expose semantic accessible names and modal role', () => {
  for (const id of ['portfolio-editor-title', 'business-profile-editor-title', 'service-editor-title',
    'reject-outreach-title', 'opportunity-drawer-title']) {
    assert(app.includes(`aria-labelledby="${id}"`), id)
    assert(app.includes(`id="${id}"`), id)
  }
  assert(app.includes('aria-describedby="reject-outreach-description"'))
  assert((app.match(/aria-modal="true"/g) || []).length >= 5)
})

test('modal keyboard focus traps forward and reverse tab and restores focus on close', () => {
  assert(hook.includes("document.addEventListener('keydown', onKeyDown)"))
  assert(hook.includes("document.removeEventListener('keydown', onKeyDown)"))
  assert(hook.includes("event.key !== 'Tab'"))
  assert(hook.includes("event.shiftKey && focused === first"))
  assert(hook.includes("!event.shiftKey && focused === last"))
  assert(hook.includes("previousFocus.focus({ preventScroll: true })"))
  assert(hook.includes("previousFocus.isConnected"))
  assert(hook.includes("activeLocks += 1"))
  assert(hook.includes("document.body.style.overflow = previousOverflow"))
})

test('calendar Escape closes calendar without prematurely closing opportunity drawer', () => {
  assert(hook.includes("modal.querySelector('[role=\"dialog\"][aria-label=\"Choose follow-up date\"]')"))
  assert(app.includes("calendarRef.current?.querySelector('[aria-haspopup=\"dialog\"]')?.focus"))
  assert(app.includes('responsive-date-popover'))
  assert(!app.includes('w-full min-w-72 rounded-xl border border-slate-700'))
})

test('calendar uses flexible day cells and small screens never demand a wide calendar', () => {
  assert(app.includes('flex h-9 w-full min-w-0 items-center justify-center rounded-lg text-sm transition'))
  assert(css.includes('.responsive-date-popover'))
  assert(css.includes('max-width:100%'))
  assert(css.includes('@media(max-width:360px)'))
})

test('settings editors and rejected-outreach dialog are safely scrollable on narrow screens', () => {
  assert(css.includes('.service-editor-overlay .service-editor-panel'))
  assert(css.includes('height:100dvh'))
  assert(css.includes('overscroll-behavior:contain'))
  assert(css.includes('max-height:calc(100dvh - 2rem)'))
  assert(css.includes('env(safe-area-inset-bottom'))
  assert(css.includes('@media(max-width:640px)'))
})

test('source and other opportunity filters have accessible names', () => {
  const start = app.indexOf('function FilterBar({')
  const end = app.indexOf('// STAT CARD', start)
  const bar = app.slice(start, end)
  for (const name of ['Search opportunities', 'Filter by recommended action',
    'Filter by opportunity score', 'Filter by draft status', 'Filter by opportunity status']) {
    assert(bar.includes(`aria-label="${name}"`), name)
  }
})

test('clear-all resets every filter including platform selections, not sorting', () => {
  assert(app.includes('hasActiveFilters={Boolean('))
  assert(app.includes('selectedPlatforms.length > 0'))
  assert(app.includes('onClick={onResetFilters}'))
  assert(app.includes('Clear all filters'))
  const start = app.indexOf('onResetFilters={() => {')
  const end = app.indexOf('\n            }}', start)
  const reset = app.slice(start, end)
  for (const setter of [
    "setSearchTerm('')", "setActionFilter('all')", "setScoreFilter('all')",
    "setDraftFilter('all')", "setStatusFilter('all')",
    "setFollowUpFilter('all')", "setSelectedPlatforms([])",
  ]) assert(reset.includes(setter), `missing reset ${setter}`)
  assert(!reset.includes('setOpportunitySort('), 'Sorting is a separate preference.')
})

test('critical discovery and manual outreach actions remain wired', () => {
  assert(app.includes('onClick={() => void handleFindOpportunities()}'))
  assert(app.includes('onClick={() => void approveOpportunity(lead)}'))
  assert(app.includes('onClick={() => void saveEditedOpportunity(lead)}'))
  assert(app.includes('onClick={() => void copyApprovedMessage(lead)}'))
  assert(app.includes('onClick={() => void markOutreachAsSent(lead)}'))
  assert(app.includes('onClick={() => void rejectOpportunity()}'))
  assert(app.includes('onClick={() => void saveSearchSettings()}'))
  assert(app.includes('void saveBusinessProfile()'))
})

test('modal source handles disabled close actions during pending writes', () => {
  assert(app.includes('if (reviewActionPendingRef.current) return'))
  assert(app.includes('if (businessProfileSaving) return'))
  assert(app.includes('if (serviceSaving) return'))
  assert(app.includes('if (portfolioSaving) return'))
})
