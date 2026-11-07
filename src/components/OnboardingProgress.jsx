import { Check, Sparkles } from 'lucide-react'
import {
  ONBOARDING_STEPS, ONBOARDING_MILESTONES,
  getOnboardingStepMeta, getOnboardingMilestone,
} from '../config/profileExperience'

/**
 * Presentation-only: milestone navigation never bypasses the step-level persistence guards.
 */
export default function OnboardingProgress({ currentStep, workspaceName }) {
  const step = getOnboardingStepMeta(currentStep)
  const milestone = getOnboardingMilestone(currentStep)
  return (
    <section className="onboard-v2-progress onboard-v3-progress" aria-label="Onboarding progress">
      <div className="onboard-v2-progress-top">
        <div className="onboard-v2-progress-heading">
          <span className="onboard-v2-eyebrow"><Sparkles size={14} aria-hidden="true" /> CLIENT DISCOVERY SETUP</span>
          <h2>{step.title} <span>— Step {step.id} of {ONBOARDING_STEPS.length}</span></h2>
          <p>{step.description}</p>
        </div>
        <span className="onboard-v2-workspace" title={workspaceName || 'Your workspace'}>
          {workspaceName || 'Your workspace'}
        </span>
      </div>
      <div className="onboard-v3-milestones" role="list" aria-label="Three setup milestones">
        {ONBOARDING_MILESTONES.map((item, index) => {
          const isCurrent = item.id === milestone.id
          const previous = item.stepIds[item.stepIds.length - 1] < currentStep
          return (
            <div role="listitem" key={item.id}
              className={`onboard-v3-milestone${isCurrent ? ' is-current' : ''}${previous ? ' is-previous' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}>
              <span className="onboard-v3-milestone-number" aria-hidden="true">{previous ? <Check size={15} /> : index + 1}</span>
              <div><strong>{item.title}</strong><small>{item.description}</small></div>
            </div>
          )
        })}
      </div>
      <p className="onboard-v3-progress-caption">Three simple milestones, with five saved steps to protect your answers.</p>
      <ol className="onboard-v2-step-list">
        {ONBOARDING_STEPS.map(item => {
          const current = item.id === currentStep
          const earlier = item.id < currentStep
          return (
            <li key={item.id} className={`onboard-v2-step${current ? ' is-current' : ''}${earlier ? ' is-previous' : ''}`}
              aria-current={current ? 'step' : undefined}>
              <span className="onboard-v2-step-number" aria-hidden="true">
                {earlier ? <Check size={14} /> : item.id}
              </span>
              <div><strong>{item.title}</strong><small>{item.subtitle}</small></div>
            </li>
          )
        })}
      </ol>
      <div className="onboard-v2-guide">
        <span>WHAT MATTERS HERE</span>
        <p>{step.tip}</p>
      </div>
      <p className="onboard-v2-progress-note">
        The progress display is informational. Save &amp; Continue stores each step before proceeding.
        Proof of work is optional and can be added later.
      </p>
    </section>
  )
}
