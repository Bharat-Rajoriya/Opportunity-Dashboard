# Frontend/UI Redesign V1 — Opportunity Dashboard

## Goal
A professional sales workspace that makes the next action obvious, reduces cognitive load, and preserves the working opportunity engine. V1 is the navigation, overview, and foundation—not a rewrite of every existing panel.

## Visual system
- **Canvas:** deep blue-black (`#0a1020`).
- **Surface:** ink/slate (`#111c31`); subtle borders (`#2c3b56`).
- **Primary accent:** restrained lavender (`#c6b7ff`); meaningful success/warning remain distinct.
- **Type:** native system sans with compact eyebrow text, strongly hierarchical headings, small descriptive metadata.
- **Surfaces:** 10–22px radii, consistent spacing and focus rings; no gratuitous gradients outside the overview.
- **Accessibility:** keyboard-operable sidebar, selected-state semantics, visible focus, reduced-motion support, overflow-safe mobile navigation.

## Information architecture
| Section | User job | V1 behavior |
|---|---|---|
| Overview | Know what needs attention | Workspace pulse + contextual next action |
| Discovery | Find buyers | Jumps to existing search and diagnostics |
| Opportunities | Evaluate and prioritize | Jumps to existing searchable, scored pipeline |
| Outreach | Review and approve pitches | Jumps to existing review/approved outreach queues |
| Follow-ups | Keep conversations moving | Jumps to existing follow-up controls |
| Settings | Tune the engine | Switches to existing business/services/search settings |

## Desktop wireframe

```text
┌─────────────────┬─────────────────────────────────────────────────────────┐
│ ◈ Opportunity   │ WORKSPACE / OVERVIEW                        [Refresh]   │
│   INTELLIGENCE  │ Overview                                                │
│ ─────────────── │ ┌────────────────────────────┬──────────────────────┐ │
│ WORKSPACE       │ │ Less searching.            │ WORKSPACE PULSE      │ │
│ ▸ Overview      │ │ More opportunity.          │ Latest run status    │ │
│   Discovery     │ │                            │                      │ │
│   Opportunities │ │ [Explore discovery]        │ Recommended next    │ │
│   Outreach      │ │ [Browse opportunities]     │ action + sources     │ │
│   Follow-ups    │ └────────────────────────────┴──────────────────────┘ │
│                 │ ┌─────────────────────────────────────────────────────┐ │
│ PREFERENCES     │ │ Find new opportunities                    [Run]     │ │
│   Settings      │ │ Last run breakdown / diagnostics                    │ │
│                 │ └─────────────────────────────────────────────────────┘ │
│ ─────────────── │ ┌────────────┬────────────┬────────────┬────────────┐ │
│ Workspace       │ │ Total      │ Pitch ready│ High score │ Drafts     │ │
│ [Sign out]      │ └────────────┴────────────┴────────────┴────────────┘ │
│                 │ Follow-ups → Review → Approved → Opportunities         │
└─────────────────┴─────────────────────────────────────────────────────────┘
```

## Small-screen wireframe

```text
┌────────────────────────────────────┐
│ ◈ Opportunity            [Sign out]│
│ [Overview] [Discovery] [Leads] →  │  <- horizontally scrollable
├────────────────────────────────────┤
│ WORKSPACE / OVERVIEW               │
│ Overview                 [Refresh] │
│ ┌────────────────────────────────┐ │
│ │ Less searching.               │ │
│ │ More opportunity.             │ │
│ │ [Explore discovery]           │ │
│ ├────────────────────────────────┤ │
│ │ Recommended action            │ │
│ │ Configured sources            │ │
│ └────────────────────────────────┘ │
│ [Search] → [Metrics] → [Queue]      │
└────────────────────────────────────┘
```

## Constraints and next iterations
- Do not change Supabase schemas, n8n scoring, provider gating, authentication, or payment state from a visual redesign PR.
- Configured source tags **are not** provider-availability indicators; SerpApi can be exhausted.
- Existing reviewer approvals, human-send confirmation, and workspace guards stay intact.
- V1 navigation is section-based, not a route rewrite; later iterations may split full pages after their data contracts and user journeys are reviewed.
- V2 UI: opportunity card/detail improvements, source-status diagnostics, outreach review design, then onboarding simplification.
