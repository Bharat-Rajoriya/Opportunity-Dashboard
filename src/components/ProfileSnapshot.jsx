import { BriefcaseBusiness, CheckCircle2, Circle, CircleHelp, Sparkles } from 'lucide-react'
import { getProfileOverview } from '../config/profileExperience'

export default function ProfileSnapshot({
  profile, services, proofs, servicesLoading = false, proofsLoading = false,
  compact = false,
}) {
  const summary = getProfileOverview(profile, services, proofs, { servicesLoading, proofsLoading })
  const languages = Array.isArray(profile?.working_languages)
    ? profile.working_languages.filter(value => typeof value === 'string' && value.trim())
    : []
  const allChecks = [...summary.essentials, ...summary.optional]
  return (
    <section className={`profile-v2-summary${compact ? ' is-compact' : ''}`}
      aria-label={compact ? 'Current setup snapshot' : 'Saved business profile summary'}>
      <div className="profile-v2-summary-header">
        <div>
          <span className="profile-v2-eyebrow"><Sparkles size={14} aria-hidden="true" /> {compact ? 'SETUP SNAPSHOT' : 'BUSINESS CONTEXT'}</span>
          <h3>{compact ? 'What you have entered' : profile?.business_name || 'Your business profile'}</h3>
          <p>{compact
            ? 'A quick view of the answers in this session. Complete each step to save them.'
            : 'These details guide matching and outreach. Verify your claims before using them in pitches.'}</p>
        </div>
        <div className="profile-v2-progress-count" aria-label={summary.pending
          ? 'Setup checklist is still loading'
          : `${summary.completed} of ${summary.total} core setup inputs present`}>
          <strong>{summary.pending ? '—' : `${summary.completed}/${summary.total}`}</strong>
          <span>CORE INPUTS</span>
        </div>
      </div>
      {!compact && (
        <div className="profile-v2-identity-grid">
          <div><span>Business type</span><strong>{profile?.business_type?.replaceAll('_', ' ') || 'Not set'}</strong></div>
          <div><span>Base country</span><strong>{profile?.provider_country || 'Not set'}</strong></div>
          <div><span>Working languages</span><strong>{languages.join(', ') || profile?.preferred_language || 'Not set'}</strong></div>
          <div><span>Active services</span><strong>{servicesLoading ? 'Loading…' : summary.activeServiceCount}</strong></div>
          <div><span>Active proof items</span><strong>{proofsLoading ? 'Loading…' : summary.activeProofCount}</strong></div>
        </div>
      )}
      {!compact && (
        <div className="profile-v2-goal">
          <span><BriefcaseBusiness size={15} aria-hidden="true" /> PRIMARY GOAL</span>
          <p>{profile?.primary_goal?.trim() || 'Not set. Describe the buyer requests your business wants to find.'}</p>
        </div>
      )}
      <ul className="profile-v2-checks">
        {allChecks.map(item => (
          <li key={item.id} className={`profile-v2-check${item.ready ? ' is-ready' : ''}`}>
            {item.loading ? <CircleHelp size={16} aria-hidden="true" />
              : item.ready ? <CheckCircle2 size={16} aria-hidden="true" />
                : <Circle size={16} aria-hidden="true" />}
            <div>
              <strong>{item.label}</strong>
              <span>{item.loading ? 'Checking saved items…'
                : item.ready ? 'Provided'
                  : item.suggestion}</span>
            </div>
            {summary.optional.some(optional => optional.id === item.id) && (
              <small>OPTIONAL</small>
            )}
          </li>
        ))}
      </ul>
      <p className="profile-v2-note">{summary.note}</p>
    </section>
  )
}
