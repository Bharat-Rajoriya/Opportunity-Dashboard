import { Check, Sparkles } from 'lucide-react'
import { ONBOARDING_STEPS, getOnboardingStepMeta } from '../config/profileExperience'

/** Informational progress; navigation remains gated by each step's save action. */
export default function OnboardingProgress({ currentStep, workspaceName }) {
  const step = getOnboardingStepMeta(currentStep)
  return (
    <section className="onboard-v2-progress" aria-label="Onboarding progress">
      <div className="onboard-v2-progress-top">
        <div className="onboard-v2-progress-heading">
          <span className="onboard-v2-eyebrow"><Sparkles size={14} aria-hidden="true" /> WORKSPACE SETUP</span>
          <h2>{step.title} <span>— Step {step.id} of {ONBOARDING_STEPS.length}</span></h2>
          <p>{step.description}</p>
        </div>
        <span className="onboard-v2-workspace" title={workspaceName || 'Your workspace'}>
          {workspaceName || 'Your workspace'}
        </span>
      </div>
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
        <span>TIP FOR THIS STEP</span>
        <p>{step.tip}</p>
      </div>
      <p className="onboard-v2-progress-note">Use Save &amp; Continue to move forward. Earlier steps can be revisited using Back; later steps stay protected by their existing save checks.</p>
    </section>
  )
}
