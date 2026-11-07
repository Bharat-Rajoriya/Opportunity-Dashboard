import {
  BriefcaseBusiness, CalendarClock, Compass, LayoutDashboard,
  LogOut, MessageSquareText, Settings2, Activity, Sparkles, Search, Plug, Bookmark,
} from 'lucide-react'
import { WORKSPACE_SECTIONS } from '../config/workspaceUi'

const icons = {
  overview: LayoutDashboard, search: Search, 'saved-searches': Bookmark, sources: Plug, discovery: Compass,
  opportunities: BriefcaseBusiness, outreach: MessageSquareText,
  followups: CalendarClock, diagnostics: Activity, settings: Settings2,
}

export default function WorkspaceShell({
  workspaceName, userEmail, activeSection, onNavigate, onSignOut, children,
}) {
  const name = String(workspaceName || 'My workspace').trim()
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar" aria-label="Workspace navigation">
        <button type="button" className="workspace-brand"
          onClick={() => onNavigate('overview')} aria-label="Go to workspace overview">
          <span className="workspace-brand-mark"><Sparkles size={22} aria-hidden="true" /></span>
          <span className="workspace-brand-copy"><strong>Opportunity</strong><small>INTELLIGENCE WORKSPACE</small></span>
        </button>
        <div className="workspace-sidebar-rule" aria-hidden="true" />
        <nav className="workspace-navigation" aria-label="Workspace sections">
          {WORKSPACE_SECTIONS.map((section, index) => {
            const Icon = icons[section.id]
            const selected = activeSection === section.id
            const showGroup = index === 0 || WORKSPACE_SECTIONS[index - 1].group !== section.group
            return (
              <div className="workspace-nav-entry" key={section.id}>
                {showGroup && <p className="workspace-nav-group-label">
                  {section.group === 'manage' ? 'PREFERENCES' : 'WORKSPACE'}
                </p>}
                <button type="button" onClick={() => onNavigate(section.id)}
                  aria-pressed={selected}
                  className={`workspace-nav-link${selected ? ' is-active' : ''}`}>
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                  <span>{section.label}</span>
                  {selected && <i className="workspace-nav-indicator" aria-hidden="true" />}
                </button>
              </div>
            )
          })}
        </nav>
        <div className="workspace-sidebar-footer">
          <div className="workspace-account">
            <span className="workspace-account-avatar" aria-hidden="true">{name.charAt(0).toUpperCase() || 'W'}</span>
            <span className="workspace-account-copy">
              <strong title={name}>{name}</strong>
              <small title={userEmail || ''}>{userEmail || 'Signed in'}</small>
            </span>
          </div>
          <button type="button" className="workspace-signout"
            onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main id="workspace-main" className="workspace-main">{children}</main>
    </div>
  )
}
