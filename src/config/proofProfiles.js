export const PROOF_TYPE_OPTIONS = [
  ['profile', 'Profile / Portfolio Link'],
  ['project', 'Project / Work Sample'],
  ['case_study', 'Case Study'],
  ['publication', 'Publication / Article'],
  ['testimonial', 'Testimonial / Review'],
  ['certification', 'Certification / Credential'],
  ['other', 'Other Proof'],
]

const configs = {
  profile: {
    fields: [
      'platform',
      'project_name',
      'services',
      'technologies',
      'project_url',
      'summary',
      'proof_points',
    ],
    labels: {
      platform: 'Platform / Website',
      project_name: 'Profile / Portfolio Title',
      services: 'Services / Expertise Represented',
      technologies: 'Skills / Specialties',
      project_url: 'Profile / Portfolio URL',
      summary: 'What This Profile Demonstrates',
      proof_points: 'Key Evidence (optional)',
    },
    placeholders: {
      platform: 'e.g. Dribbble, LinkedIn, YouTube, personal website',
      project_name: 'e.g. Creative portfolio, professional profile, work showcase',
      services: 'e.g. the services or expertise represented on this profile',
      technologies: 'e.g. your main skills, specialties, topics or methods',
      project_url: 'https://example.com/your-profile',
      summary: 'Briefly explain what someone can learn about your work or expertise from this profile.',
      proof_points: 'e.g. Featured work\nClient reviews\nPublished examples',
    },
  },
  project: {
    fields: [
      'platform',
      'project_name',
      'client_name',
      'industry',
      'services',
      'technologies',
      'project_url',
      'summary',
      'proof_points',
    ],
    labels: {
      platform: 'Source / Platform (optional)',
      project_name: 'Work Sample Title',
      client_name: 'Client / Organization (optional)',
      industry: 'Industry / Category (optional)',
      services: 'Services Delivered',
      technologies: 'Skills / Methods / Tools',
      project_url: 'Work Sample URL',
      summary: 'Work Summary',
      proof_points: 'Results / Evidence',
    },
    placeholders: {
      platform: 'e.g. Website, Behance, Google Drive, public case page',
      project_name: 'e.g. Client engagement, campaign, design project, advisory work',
      client_name: 'e.g. client or organization name',
      industry: 'e.g. retail, healthcare, professional services, education',
      services: 'e.g. the services you delivered',
      technologies: 'e.g. skills, methods, tools or specialist topics used',
      project_url: 'https://example.com/work-sample',
      summary: 'Explain the requirement, what you contributed and the scope of the work.',
      proof_points: 'e.g. Delivered agreed scope\nImproved a measurable outcome\nSolved a specific client problem',
    },
  },
  case_study: {
    fields: [
      'platform',
      'project_name',
      'client_name',
      'industry',
      'services',
      'project_url',
      'summary',
      'proof_points',
    ],
    labels: {
      platform: 'Published On / Source (optional)',
      project_name: 'Case Study Title',
      client_name: 'Client / Organization (optional)',
      industry: 'Industry / Category (optional)',
      services: 'Services Covered',
      project_url: 'Case Study URL',
      summary: 'Case Study Summary',
      proof_points: 'Outcomes / Evidence',
    },
    placeholders: {
      platform: 'e.g. your website, agency site, publication',
      project_name: 'e.g. How we solved a client problem',
      client_name: 'e.g. client or organization name',
      industry: 'e.g. hospitality, legal, ecommerce, finance',
      services: 'e.g. the services demonstrated in this case study',
      project_url: 'https://example.com/case-study',
      summary: 'Summarize the challenge, your approach and the work completed.',
      proof_points: 'e.g. measurable outcome\nClient-approved result\nDocumented before/after improvement',
    },
  },
  publication: {
    fields: [
      'platform',
      'project_name',
      'industry',
      'technologies',
      'project_url',
      'summary',
      'proof_points',
    ],
    labels: {
      platform: 'Publisher / Platform',
      project_name: 'Publication Title',
      industry: 'Topic / Category (optional)',
      technologies: 'Topics / Expertise',
      project_url: 'Publication URL',
      summary: 'What This Publication Demonstrates',
      proof_points: 'Credibility Signals (optional)',
    },
    placeholders: {
      platform: 'e.g. LinkedIn, industry journal, Medium, news publication',
      project_name: 'e.g. article, guide, research note or published insight',
      industry: 'e.g. employment law, paid media, branding, finance',
      technologies: 'e.g. subjects, expertise or specialist topics covered',
      project_url: 'https://example.com/publication',
      summary: 'Explain what the publication covers and what expertise it demonstrates.',
      proof_points: 'e.g. Published by recognized outlet\nCited research\nExpert commentary',
    },
  },
  testimonial: {
    fields: [
      'platform',
      'project_name',
      'client_name',
      'services',
      'project_url',
      'summary',
    ],
    labels: {
      platform: 'Source / Platform',
      project_name: 'Testimonial / Review Title',
      client_name: 'Client / Reviewer (optional)',
      services: 'Service Referenced (optional)',
      project_url: 'Review / Testimonial URL',
      summary: 'Testimonial / Context',
    },
    placeholders: {
      platform: 'e.g. Google, LinkedIn, Clutch, email, your website',
      project_name: 'e.g. Client review for advisory engagement',
      client_name: 'e.g. client, reviewer or organization',
      services: 'e.g. the service the review relates to',
      project_url: 'https://example.com/review',
      summary: 'Add the testimonial text or a factual summary of the feedback.',
    },
  },
  certification: {
    fields: [
      'platform',
      'project_name',
      'industry',
      'technologies',
      'project_url',
      'summary',
    ],
    labels: {
      platform: 'Issuer / Platform',
      project_name: 'Certification / Credential',
      industry: 'Category (optional)',
      technologies: 'Skills / Competencies',
      project_url: 'Credential URL',
      summary: 'What This Credential Validates',
    },
    placeholders: {
      platform: 'e.g. professional body, university, certification provider',
      project_name: 'e.g. certification, licence, accreditation or credential',
      industry: 'e.g. legal, finance, marketing, design, technology',
      technologies: 'e.g. competencies, subjects or specialist skills validated',
      project_url: 'https://example.com/credential',
      summary: 'Briefly explain what this credential validates.',
    },
  },
  other: {
    fields: [
      'platform',
      'project_name',
      'industry',
      'services',
      'technologies',
      'project_url',
      'summary',
      'proof_points',
    ],
    labels: {
      platform: 'Source / Platform (optional)',
      project_name: 'Proof Title',
      industry: 'Category (optional)',
      services: 'Related Services (optional)',
      technologies: 'Skills / Topics (optional)',
      project_url: 'Evidence URL (optional)',
      summary: 'Description',
      proof_points: 'Evidence / Proof Points (optional)',
    },
    placeholders: {
      platform: 'e.g. website, directory, publication or platform',
      project_name: 'e.g. award, media mention, work sample or other evidence',
      industry: 'e.g. category or area of expertise',
      services: 'e.g. services this evidence supports',
      technologies: 'e.g. relevant skills, topics or methods',
      project_url: 'https://example.com/evidence',
      summary: 'Explain what this evidence is and why it is relevant.',
      proof_points: 'e.g. factual evidence\nRecognition\nVerified outcome',
    },
  },
}

const allConditionalFields = [
  'platform',
  'client_name',
  'industry',
  'services',
  'technologies',
  'project_url',
  'summary',
  'proof_points',
]

export function getProofTypeConfig(type) {
  return configs[type] || configs.other
}

export function isProofFieldVisible(type, field) {
  return getProofTypeConfig(type).fields.includes(field)
}

export function getProofFieldMeta(type, field) {
  const config = getProofTypeConfig(type)

  return {
    label: config.labels[field] || field,
    placeholder: config.placeholders[field] || '',
  }
}

export function changeProofType(form, nextType) {
  const config = getProofTypeConfig(nextType)
  const visible = new Set(config.fields)

  const next = {
    ...form,
    proof_type: nextType,
  }

  for (const field of allConditionalFields) {
    if (!visible.has(field)) {
      next[field] = ''
    }
  }

  return next
}

export function sanitizeProofFormForType(form) {
  return changeProofType(form, form?.proof_type || 'other')
}
