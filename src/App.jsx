import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Send,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import Onboarding from './components/Onboarding'
import {
  generateOnboardingCopy,
  generateOpportunityPitch,
  getLatestEngineRun,
  triggerAiQueryGeneration,
  triggerOpportunityEngine,
} from './services/opportunityEngine'
import {
  fetchActiveSearchProfile,
  fetchSearchProfileById,
  normalizeSearchList,
  normalizeSourceKeys,
  normalizeSourcePreferences,
  saveActiveSearchProfile,
} from './services/searchProfiles'
import {
  fetchSourceAnalytics,
  getAdaptiveSourceStrategy,
} from './services/sourceAnalytics'
import {
  PROOF_TYPE_OPTIONS,
  changeProofType,
  getProofFieldMeta,
  isProofFieldVisible,
  sanitizeProofFormForType,
} from './config/proofProfiles'
import './App.css'

const REJECTION_REASONS = [
  ['not_relevant', 'Not relevant'],
  ['rate_too_low', 'Rate too low'],
  ['poor_lead_quality', 'Poor lead quality'],
  ['wrong_contact', 'Wrong contact'],
  ['bad_draft', 'Bad draft'],
  ['other', 'Other'],
]

const SEARCH_COUNTRIES = ['USA', 'UK', 'UAE', 'Australia', 'India']

const FREELANCER_PRODUCTION_ENABLED =
  import.meta.env.VITE_FREELANCER_PRODUCTION_ENABLED === 'true'

const SOURCE_CATALOG = [
  {
    key: 'google',
    name: 'Google Web Search',
    description: 'Broad web discovery through the existing search collector.',
    status: 'Live',
    available: true,
  },
  {
    key: 'freelancer',
    name: 'Freelancer',
    description: 'Direct marketplace projects through the official Freelancer API.',
    status: FREELANCER_PRODUCTION_ENABLED
      ? 'Production connected'
      : 'Sandbox verified',
    available: FREELANCER_PRODUCTION_ENABLED,
  },
]

function validateSignUp(email, password, confirmPassword) {
  if (!email.trim()) return 'Email is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password !== confirmPassword) return 'Passwords do not match.'
  return ''
}

function getFollowUpBucket(opportunity) {
  if (!opportunity?.next_follow_up_at) return null

  const followUp = new Date(opportunity.next_follow_up_at)
  const now = new Date()

  if (Number.isNaN(followUp.getTime())) return null
  if (followUp < now) return 'overdue'

  const isToday =
    followUp.getFullYear() === now.getFullYear() &&
    followUp.getMonth() === now.getMonth() &&
    followUp.getDate() === now.getDate()

  return isToday ? 'today' : 'upcoming'
}

function formatFollowUpDate(dateString) {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function App() {
  // -----------------------------------------------------
  // STATE
  // -----------------------------------------------------
  const [user, setUser] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')
  const workspaceLoadRequest = useRef(0)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [authMode, setAuthMode] = useState('sign-in')

  const [authLoading, setAuthLoading] = useState(true)
  const [authActionLoading, setAuthActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [authMessageType, setAuthMessageType] = useState('error')
  const [searchRunning, setSearchRunning] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [searchError, setSearchError] = useState('')
  const searchRunRequest = useRef(0)
  const searchRunPendingRef = useRef(null)
  const [engineRun, setEngineRun] = useState(null)
  const [searchProfile, setSearchProfile] = useState(null)
  const [searchQueries, setSearchQueries] = useState([])
  const [targetCountries, setTargetCountries] = useState([])
  const [minIntentLevel, setMinIntentLevel] = useState(3)
  const [maxAgeHours, setMaxAgeHours] = useState(72)
  const [aiQueryGenerationEnabled, setAiQueryGenerationEnabled] = useState(true)
  const [aiSuggestedQueries, setAiSuggestedQueries] = useState([])
  const [aiQueriesGeneratedAt, setAiQueriesGeneratedAt] = useState(null)
  const [queryBatchSize, setQueryBatchSize] = useState(10)
  const [enabledSources, setEnabledSources] = useState(['google'])
  const [freelancerResultLimit, setFreelancerResultLimit] = useState(10)
  const [sourceAnalytics, setSourceAnalytics] = useState({})
  const [sourceAnalyticsLoading, setSourceAnalyticsLoading] = useState(false)
  const [sourceAnalyticsError, setSourceAnalyticsError] = useState('')
  const sourceAnalyticsRequest = useRef(0)
  const [aiQueriesGenerating, setAiQueriesGenerating] = useState(false)
  const [searchSettingsLoading, setSearchSettingsLoading] = useState(true)
  const [searchSettingsSaving, setSearchSettingsSaving] = useState(false)
  const [searchSettingsError, setSearchSettingsError] = useState('')
  const [searchSettingsMessage, setSearchSettingsMessage] = useState('')
  const searchSettingsRequest = useRef(0)
  const searchSettingsSavePendingRef = useRef(false)
  const [businessProfile, setBusinessProfile] = useState(null)
  const [businessProfileLoading, setBusinessProfileLoading] = useState(false)
  const [businessProfileSaving, setBusinessProfileSaving] = useState(false)
  const [businessProfileError, setBusinessProfileError] = useState('')
  const [businessProfileMessage, setBusinessProfileMessage] = useState('')
  const [businessProfileAiField, setBusinessProfileAiField] = useState('')
  const [businessProfileAiMessage, setBusinessProfileAiMessage] = useState('')
  const [businessProfileEditorOpen, setBusinessProfileEditorOpen] = useState(false)
  const [businessProfileForm, setBusinessProfileForm] = useState({
    business_name: '',
    business_type: '',
    website_url: '',
    primary_goal: '',
    preferred_language: '',
    provider_country: '',
    working_languages: [],
    ideal_client_types: [],
    rejection_rules: [],
    good_opportunity_definition: '',
  })
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesError, setServicesError] = useState('')
  const [portfolioItems, setPortfolioItems] = useState([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState('')
  const [editingPortfolio, setEditingPortfolio] = useState(null)
  const [portfolioDrawerOpen, setPortfolioDrawerOpen] = useState(false)
  const [portfolioSaving, setPortfolioSaving] = useState(false)
  const [portfolioSaveError, setPortfolioSaveError] = useState('')
  const [portfolioSaveMessage, setPortfolioSaveMessage] = useState('')
  const [portfolioForm, setPortfolioForm] = useState({
    proof_type: 'profile',
    platform: '',
    project_name: '',
    client_name: '',
    industry: '',
    services: '',
    technologies: '',
    project_url: '',
    summary: '',
    proof_points: '',
    active: true,
  })
  const [editingService, setEditingService] = useState(null)
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false)
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    keywords: [],
    problems_solved: [],
    min_project_value: '',
    currency: 'INR',
    active: true,
  })
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceSaveError, setServiceSaveError] = useState('')
  const [serviceSaveMessage, setServiceSaveMessage] = useState('')

  const [opportunities, setOpportunities] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewQueueLoading, setReviewQueueLoading] = useState(true)
  const [reviewQueueError, setReviewQueueError] = useState('')
  const reviewQueueRequest = useRef(0)
  const [reviewActionId, setReviewActionId] = useState(null)
  const [reviewActionError, setReviewActionError] = useState(null)
  const reviewActionPendingRef = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [editedSubject, setEditedSubject] = useState('')
  const [rejectingOpportunity, setRejectingOpportunity] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionNote, setRejectionNote] = useState('')
  const [approvedOutreach, setApprovedOutreach] = useState([])
  const [approvedOutreachLoading, setApprovedOutreachLoading] = useState(true)
  const [approvedOutreachError, setApprovedOutreachError] = useState('')
  const approvedOutreachRequest = useRef(0)
  const [sendActionId, setSendActionId] = useState(null)
  const [sendActionError, setSendActionError] = useState(null)
  const sendActionPendingRef = useRef(null)
  const [copiedOutreachId, setCopiedOutreachId] = useState(null)
  const [manualPitchId, setManualPitchId] = useState(null)
  const [manualPitchError, setManualPitchError] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [activePage, setActivePage] = useState('dashboard')
  const [showAdvancedQueries, setShowAdvancedQueries] = useState(false)
  const [scoreFilter, setScoreFilter] = useState('all')
  const [draftFilter, setDraftFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [followUpFilter, setFollowUpFilter] = useState('all')
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)

  const [opportunityActivity, setOpportunityActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  const loadWorkspace = useCallback(async (currentUser) => {
    const requestId = ++workspaceLoadRequest.current
    setWorkspace(null)
    setWorkspaceError('')

    if (!currentUser) {
      setWorkspaceLoading(false)
      return false
    }

    setWorkspaceLoading(true)

    try {
      const workspaceFields = `
        id,
        name,
        owner_user_id,
        onboarding_completed,
        onboarding_completed_at
      `
      const { data, error } = await supabase
        .from('workspaces')
        .select(workspaceFields)
        .eq('owner_user_id', currentUser.id)
        .maybeSingle()

      if (requestId !== workspaceLoadRequest.current) return false
      if (error) throw error

      let currentWorkspace = data

      if (!currentWorkspace) {
        const accountName =
          currentUser.user_metadata?.full_name?.trim() ||
          currentUser.email?.split('@')[0] ||
          'My'
        const creation = await supabase
          .from('workspaces')
          .insert({
            name: `${accountName} Workspace`,
            owner_user_id: currentUser.id,
            onboarding_completed: false,
          })
          .select(workspaceFields)
          .single()

        if (requestId !== workspaceLoadRequest.current) return false

        if (creation.error) {
          // An auth event and the signup response can race to provision the
          // same workspace. If one already won, reuse that row.
          const retry = await supabase
            .from('workspaces')
            .select(workspaceFields)
            .eq('owner_user_id', currentUser.id)
            .maybeSingle()

          if (requestId !== workspaceLoadRequest.current) return false
          if (retry.error || !retry.data) throw creation.error
          currentWorkspace = retry.data
        } else {
          currentWorkspace = creation.data
        }
      }

      if (!currentWorkspace?.id) {
        throw new Error('Your workspace could not be created.')
      }

      setWorkspace(currentWorkspace)
      return true
    } catch (error) {
      if (requestId === workspaceLoadRequest.current) {
        console.error('Workspace load error:', error)
        setWorkspaceError(error?.message || 'Unable to load your workspace.')
      }
      return false
    } finally {
      if (requestId === workspaceLoadRequest.current) {
        setWorkspaceLoading(false)
      }
    }
  }, [])

  // -----------------------------------------------------
  // LOAD OPPORTUNITIES
  // -----------------------------------------------------
  const fetchOpportunities = async (workspaceId) => {
    setDataLoading(true)
    setDataError('')

    if (!workspaceId) {
      setOpportunities([])
      setDataLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          workspace_id,
          title,
          source,
          source_url,
          country,
          source_result_type,
          source_quality_score,
          source_quality_reason,
          buyer_likelihood,
          requirement,
          person_name,
          company_name,
          company_website,
          budget_text,
          estimated_value_min,
          estimated_value_max,
          estimated_currency,
          commercial_fit,
          budget_fit_ratio,
          matched_service_min_value,
          matched_service_currency,
          normalized_budget_max,
          commercial_value_reason,
          scope_complexity,
          scope_reason,
          scope_multiplier,
          scope_adjusted_min_value,
          scope_budget_fit_ratio,
          scope_budget_fit,
          scope_budget_fit_reason,
          contact_email,
          contact_phone,
          project_type,
          duration_text,
          workload_text,
          experience_level,
          location_text,
          remote_status,
          skills,
          project_language,
          eligibility_match,
          eligibility_restriction_type,
          required_country,
          required_language,
          eligibility_reason,
          total_score,
          preliminary_score,
          score_stage,
          research_status,
          status,
          recommended_action,
          recommended_portfolio_id,
          outreach_status,
          outreach_review_status,
          outreach_channel,
          outreach_subject,
          outreach_message,
          outreach_angle,
          next_follow_up_at,
          follow_up_note,
          created_at,
          updated_at
        `)
        .eq('workspace_id', workspaceId)
        .order('total_score', { ascending: false })

      if (error) throw error

      setOpportunities(data ?? [])
    } catch (error) {
      console.error('Opportunity fetch error:', error)
      setDataError(error?.message || 'Unable to load opportunities.')
      setOpportunities([])
    } finally {
      setDataLoading(false)
    }
  }

  const loadBusinessProfile = useCallback(async (workspaceId) => {
    if (!workspaceId) return

    setBusinessProfileLoading(true)
    setBusinessProfileError('')

    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select(`
          id,
          workspace_id,
          business_name,
          business_type,
          website_url,
          primary_goal,
          preferred_language,
          provider_country,
          working_languages,
          ideal_client_types,
          rejection_rules,
          good_opportunity_definition,
          updated_at
        `)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (error) throw error

      setBusinessProfile(data || null)
    } catch (error) {
      console.error('Failed to load business profile:', error)
      setBusinessProfileError(
        error?.message || 'Unable to load business profile.'
      )
    } finally {
      setBusinessProfileLoading(false)
    }
  }, [])

  const openBusinessProfileEditor = () => {
    if (!businessProfile) return

    setBusinessProfileForm({
      business_name: businessProfile.business_name || '',
      business_type: businessProfile.business_type || '',
      website_url: businessProfile.website_url || '',
      primary_goal: businessProfile.primary_goal || '',
      preferred_language: businessProfile.preferred_language || '',
      provider_country: businessProfile.provider_country || '',
      working_languages: Array.isArray(businessProfile.working_languages)
        ? [...businessProfile.working_languages]
        : businessProfile.preferred_language
          ? [businessProfile.preferred_language]
          : [],
      ideal_client_types: Array.isArray(businessProfile.ideal_client_types)
        ? [...businessProfile.ideal_client_types]
        : [],
      rejection_rules: Array.isArray(businessProfile.rejection_rules)
        ? [...businessProfile.rejection_rules]
        : [],
      good_opportunity_definition:
        businessProfile.good_opportunity_definition || '',
    })

    setBusinessProfileError('')
    setBusinessProfileMessage('')
    setBusinessProfileAiMessage('')
    setBusinessProfileEditorOpen(true)
  }

  const closeBusinessProfileEditor = () => {
    if (businessProfileSaving) return

    setBusinessProfileEditorOpen(false)
    setBusinessProfileError('')
    setBusinessProfileMessage('')
    setBusinessProfileAiMessage('')
  }

  const generateBusinessProfileCopy = async (fieldType) => {
    if (!workspace?.id || businessProfileAiField) return

    const activeServices = services
      .filter((service) => service.active !== false)
      .map((service) => ({
        name: service.name,
        description: service.description,
        keywords: service.keywords,
        problems_solved: service.problems_solved,
      }))

    const roughText =
      fieldType === 'main_goal'
        ? businessProfileForm.primary_goal
        : fieldType === 'profile_filters'
          ? businessProfileForm.primary_goal ||
            businessProfileForm.good_opportunity_definition
          : businessProfileForm.good_opportunity_definition

    const context = {
      business_name: businessProfileForm.business_name.trim(),
      business_type: businessProfileForm.business_type,
      website: businessProfileForm.website_url.trim(),
      preferred_language:
        businessProfileForm.preferred_language,
      provider_country:
        businessProfileForm.provider_country.trim(),
      working_languages:
        businessProfileForm.working_languages
          .map((item) => item.trim())
          .filter(Boolean),
      primary_goal: businessProfileForm.primary_goal.trim(),
      ideal_client_types:
        businessProfileForm.ideal_client_types
          .map((item) => item.trim())
          .filter(Boolean),
      rejection_rules:
        businessProfileForm.rejection_rules
          .map((item) => item.trim())
          .filter(Boolean),
      services: activeServices,
    }

    if (
      !roughText.trim() &&
      !context.primary_goal &&
      activeServices.length === 0 &&
      context.ideal_client_types.length === 0
    ) {
      setBusinessProfileAiMessage(
        'Add a few business or service details first so AI has accurate context.'
      )
      return
    }

    setBusinessProfileAiField(fieldType)
    setBusinessProfileAiMessage('')
    setBusinessProfileError('')

    try {
      const result = await generateOnboardingCopy({
        workspaceId: workspace.id,
        fieldType,
        roughText,
        context,
      })

      if (fieldType === 'profile_filters') {
        const mergeUnique = (currentItems, suggestedItems) => {
          const seen = new Set()

          return [...currentItems, ...(suggestedItems || [])]
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => {
              const key = item.toLowerCase()

              if (!item || seen.has(key)) return false

              seen.add(key)
              return true
            })
        }

        setBusinessProfileForm((current) => ({
          ...current,
          ideal_client_types: mergeUnique(
            current.ideal_client_types,
            result.ideal_client_types
          ),
          rejection_rules: mergeUnique(
            current.rejection_rules,
            result.rejection_rules
          ),
        }))

        setBusinessProfileAiMessage(
          'AI targeting filters added. Review them before saving.'
        )
      } else {
        setBusinessProfileForm((current) => ({
          ...current,
          [fieldType === 'main_goal'
            ? 'primary_goal'
            : 'good_opportunity_definition']:
            result.generated_text,
        }))

        setBusinessProfileAiMessage(
          'AI draft generated. Review and edit it before saving.'
        )

        if (fieldType === 'main_goal') {
          try {
            const filterResult = await generateOnboardingCopy({
              workspaceId: workspace.id,
              fieldType: 'profile_filters',
              roughText: result.generated_text,
              context: {
                ...context,
                primary_goal: result.generated_text,
              },
            })

            const mergeUnique = (currentItems, suggestedItems) => {
              const seen = new Set()

              return [...currentItems, ...(suggestedItems || [])]
                .filter((item) => typeof item === 'string')
                .map((item) => item.trim())
                .filter((item) => {
                  const key = item.toLowerCase()

                  if (!item || seen.has(key)) return false

                  seen.add(key)
                  return true
                })
            }

            setBusinessProfileForm((current) => ({
              ...current,
              ideal_client_types: mergeUnique(
                current.ideal_client_types,
                filterResult.ideal_client_types
              ),
              rejection_rules: mergeUnique(
                current.rejection_rules,
                filterResult.rejection_rules
              ),
            }))

            setBusinessProfileAiMessage(
              'AI goal and targeting filters generated. Review them before saving.'
            )
          } catch (filterError) {
            console.warn(
              'Primary goal generated, but targeting filters could not be refreshed:',
              filterError
            )
          }
        }
      }
    } catch (error) {
      console.error(
        'Failed to generate business profile copy:',
        error
      )
      setBusinessProfileAiMessage(
        error?.message ||
          'Unable to generate AI-assisted copy right now.'
      )
    } finally {
      setBusinessProfileAiField('')
    }
  }

  const updateBusinessProfileArrayItem = (field, index, value) => {
    setBusinessProfileForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) =>
        itemIndex === index ? value : item
      ),
    }))
  }

  const addBusinessProfileArrayItem = (field) => {
    setBusinessProfileForm((current) => ({
      ...current,
      [field]: [...current[field], ''],
    }))
  }

  const removeBusinessProfileArrayItem = (field, index) => {
    setBusinessProfileForm((current) => ({
      ...current,
      [field]: current[field].filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }))
  }

  const saveBusinessProfile = async () => {
    if (!workspace?.id || !businessProfile?.id) {
      setBusinessProfileError('Business profile not found.')
      return
    }

    if (businessProfileSaving) return

    setBusinessProfileSaving(true)
    setBusinessProfileError('')
    setBusinessProfileMessage('')

    try {
      const idealClientTypes = [
        ...new Set(
          businessProfileForm.ideal_client_types
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ]

      const rejectionRules = [
        ...new Set(
          businessProfileForm.rejection_rules
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ]

      const workingLanguages = [
        ...new Set(
          businessProfileForm.working_languages
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ]

      const payload = {
        business_name: businessProfileForm.business_name.trim(),
        business_type: businessProfileForm.business_type,
        website_url: businessProfileForm.website_url.trim() || null,
        primary_goal: businessProfileForm.primary_goal.trim(),
        preferred_language: businessProfileForm.preferred_language.trim(),
        provider_country:
          businessProfileForm.provider_country.trim() || null,
        working_languages: workingLanguages,
        ideal_client_types: idealClientTypes,
        rejection_rules: rejectionRules,
        good_opportunity_definition:
          businessProfileForm.good_opportunity_definition.trim(),
      }

      if (!payload.business_name) {
        throw new Error('Business name is required.')
      }

      if (!payload.business_type) {
        throw new Error('Business type is required.')
      }

      const { data, error } = await supabase
        .from('business_profiles')
        .update(payload)
        .eq('id', businessProfile.id)
        .eq('workspace_id', workspace.id)
        .select()
        .single()

      if (error) throw error

      setBusinessProfile(data)

      try {
        await triggerAiQueryGeneration(workspace.id)
        setBusinessProfileMessage(
          'Business profile saved. AI search queries are being refreshed.'
        )
      } catch (queryError) {
        console.warn(
          'Business profile saved, but AI search queries could not be refreshed:',
          queryError
        )
        setBusinessProfileMessage(
          'Business profile saved. Search queries can be regenerated from Settings if needed.'
        )
      }

      setBusinessProfileEditorOpen(false)
    } catch (error) {
      console.error('Failed to save business profile:', error)

      setBusinessProfileError(
        error?.message || 'Unable to save business profile.'
      )
    } finally {
      setBusinessProfileSaving(false)
    }
  }

  const loadServices = useCallback(async (workspaceId) => {
    if (!workspaceId) {
      setServices([])
      return
    }

    setServicesLoading(true)
    setServicesError('')

    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          id,
          workspace_id,
          name,
          description,
          keywords,
          problems_solved,
          min_project_value,
          currency,
          active,
          created_at,
          updated_at
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (error) {
        throw error
      }

      setServices(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Unable to load services:', error)
      setServices([])
      setServicesError(
        error?.message || 'Unable to load services.'
      )
    } finally {
      setServicesLoading(false)
    }
  }, [])

  const loadPortfolioItems = useCallback(async (workspaceId) => {
    if (!workspaceId) {
      setPortfolioItems([])
      return
    }

    setPortfolioLoading(true)
    setPortfolioError('')

    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select(`
          id,
          workspace_id,
          proof_type,
          platform,
          project_name,
          client_name,
          industry,
          services,
          technologies,
          project_url,
          summary,
          proof_points,
          active,
          created_at,
          updated_at
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setPortfolioItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Unable to load portfolio items:', error)
      setPortfolioItems([])
      setPortfolioError(
        error?.message || 'Unable to load portfolio items.'
      )
    } finally {
      setPortfolioLoading(false)
    }
  }, [])

  const openNewPortfolio = () => {
    setEditingPortfolio(null)
    setPortfolioForm({
      proof_type: 'profile',
      platform: '',
      project_name: '',
      client_name: '',
      industry: '',
      services: '',
      technologies: '',
      project_url: '',
      summary: '',
      proof_points: '',
      active: true,
    })
    setPortfolioSaveError('')
    setPortfolioSaveMessage('')
    setPortfolioDrawerOpen(true)
  }

  const openPortfolioEditor = (item) => {
    setEditingPortfolio(item)
    setPortfolioForm({
      proof_type: item.proof_type || 'project',
      platform: item.platform || '',
      project_name: item.project_name || '',
      client_name: item.client_name || '',
      industry: item.industry || '',
      services: Array.isArray(item.services) ? item.services.join(', ') : '',
      technologies: Array.isArray(item.technologies)
        ? item.technologies.join(', ')
        : '',
      project_url: item.project_url || '',
      summary: item.summary || '',
      proof_points: Array.isArray(item.proof_points)
        ? item.proof_points.join('\n')
        : '',
      active: Boolean(item.active),
    })
    setPortfolioSaveError('')
    setPortfolioSaveMessage('')
    setPortfolioDrawerOpen(true)
  }

  const closePortfolioEditor = () => {
    if (portfolioSaving) return

    setEditingPortfolio(null)
    setPortfolioDrawerOpen(false)
    setPortfolioSaveError('')
    setPortfolioSaveMessage('')
  }

  const savePortfolio = async () => {
    if (!workspace?.id || portfolioSaving) return

    const proofDraft = sanitizeProofFormForType(portfolioForm)
    const proofType = proofDraft.proof_type || 'other'
    const platform = proofDraft.platform.trim()
    const projectName = proofDraft.project_name.trim()
    const clientName = proofDraft.client_name.trim()
    const industry = proofDraft.industry.trim()
    const services = proofDraft.services
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const technologies = proofDraft.technologies
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const projectUrl = proofDraft.project_url.trim()
    const summary = proofDraft.summary.trim()
    const proofPoints = proofDraft.proof_points
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
    const active = proofDraft.active

    if (!projectName) {
      setPortfolioSaveError('Proof title is required.')
      return
    }

    setPortfolioSaving(true)
    setPortfolioSaveError('')
    setPortfolioSaveMessage('')

    try {
      const isEditing = Boolean(editingPortfolio)
      const { data, error } = isEditing
        ? await supabase
            .from('portfolio_items')
            .update({
              proof_type: proofType,
              platform: platform || null,
              project_name: projectName,
              client_name: clientName || null,
              industry,
              services,
              technologies,
              project_url: projectUrl || null,
              summary,
              proof_points: proofPoints,
              active,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingPortfolio.id)
            .eq('workspace_id', workspace.id)
            .select()
            .single()
        : await supabase
            .from('portfolio_items')
            .insert({
              workspace_id: workspace.id,
              proof_type: proofType,
              platform: platform || null,
              project_name: projectName,
              client_name: clientName || null,
              industry,
              services,
              technologies,
              project_url: projectUrl || null,
              summary,
              proof_points: proofPoints,
              active,
            })
            .select()
            .single()

      if (error) throw error

      setPortfolioItems((current) =>
        isEditing
          ? current.map((item) => item.id === data.id ? data : item)
          : [...current, data]
      )
      setEditingPortfolio(data)
      setPortfolioForm({
        proof_type: data.proof_type || 'project',
        platform: data.platform || '',
        project_name: data.project_name || '',
        client_name: data.client_name || '',
        industry: data.industry || '',
        services: Array.isArray(data.services) ? data.services.join(', ') : '',
        technologies: Array.isArray(data.technologies)
          ? data.technologies.join(', ')
          : '',
        project_url: data.project_url || '',
        summary: data.summary || '',
        proof_points: Array.isArray(data.proof_points)
          ? data.proof_points.join('\n')
          : '',
        active: Boolean(data.active),
      })
      setPortfolioSaveMessage(
        isEditing ? 'Proof updated successfully.' : 'Proof added successfully.'
      )
    } catch (error) {
      console.error('Unable to save proof or profile:', error)
      setPortfolioSaveError(
        error?.message || 'Unable to save proof or profile.'
      )
    } finally {
      setPortfolioSaving(false)
    }
  }

  const handleAddService = () => {
    setEditingService(null)

    setServiceForm({
      name: '',
      description: '',
      keywords: [],
      problems_solved: [],
      min_project_value: '',
      currency: 'INR',
      active: true,
    })

    setServiceSaveError('')
    setServiceSaveMessage('')
    setServiceDrawerOpen(true)
  }

  const handleEditService = (service) => {
    setEditingService(service)

    setServiceForm({
      name: service.name || '',
      description: service.description || '',
      keywords: Array.isArray(service.keywords)
        ? [...service.keywords]
        : [],
      problems_solved: Array.isArray(service.problems_solved)
        ? [...service.problems_solved]
        : [],
      min_project_value: service.min_project_value || '',
      currency: service.currency || 'INR',
      active: Boolean(service.active),
    })

    setServiceSaveError('')
    setServiceSaveMessage('')
    setServiceDrawerOpen(true)
  }

  const updateServiceListItem = (field, index, value) => {
    setServiceForm((current) => {
      const items = [...(current[field] || [])]
      items[index] = value

      return {
        ...current,
        [field]: items,
      }
    })
  }

  const addServiceListItem = (field) => {
    setServiceForm((current) => ({
      ...current,
      [field]: [...(current[field] || []), ''],
    }))
  }

  const removeServiceListItem = (field, index) => {
    setServiceForm((current) => ({
      ...current,
      [field]: (current[field] || []).filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }))
  }

  const closeServiceEditor = () => {
    if (serviceSaving) return

    setEditingService(null)
    setServiceDrawerOpen(false)
    setServiceForm({
      name: '',
      description: '',
      keywords: [],
      problems_solved: [],
      min_project_value: '',
      currency: 'INR',
      active: true,
    })
    setServiceSaveError('')
    setServiceSaveMessage('')
  }

  const saveService = async () => {
    if (!serviceForm || !workspace?.id) {
      return
    }

    if (!serviceForm.name.trim()) {
      setServiceSaveError('Service name is required.')
      return
    }

    setServiceSaving(true)
    setServiceSaveError('')
    setServiceSaveMessage('')

    try {
      const isEditing = Boolean(editingService)
      const payload = {
        workspace_id: workspace.id,
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim(),

        keywords: serviceForm.keywords
          .map((item) => item.trim())
          .filter(Boolean),

        problems_solved: serviceForm.problems_solved
          .map((item) => item.trim())
          .filter(Boolean),

        min_project_value:
          Number(serviceForm.min_project_value) || 0,

        currency: serviceForm.currency,

        active: serviceForm.active,
      }

      const { data, error } = isEditing
        ? await supabase
            .from('services')
            .update(payload)
            .eq('id', editingService.id)
            .eq('workspace_id', workspace.id)
            .select()
            .single()
        : await supabase
            .from('services')
            .insert(payload)
            .select()
            .single()

      if (error) {
        throw error
      }

      setServices((current) =>
        isEditing
          ? current.map((service) =>
              service.id === data.id
                ? data
                : service
            )
          : [...current, data]
      )

      setEditingService(data)

      setServiceForm({
        name: data.name || '',
        description: data.description || '',
        keywords: Array.isArray(data.keywords)
          ? [...data.keywords]
          : [],
        problems_solved: Array.isArray(data.problems_solved)
          ? [...data.problems_solved]
          : [],
        min_project_value: data.min_project_value || '',
        currency: data.currency || 'INR',
        active: Boolean(data.active),
      })

      setServiceSaveMessage(
        isEditing
          ? 'Service updated successfully.'
          : 'Service added successfully.'
      )
    } catch (error) {
      console.error('Unable to save service:', error)

      setServiceSaveError(
        error?.message || 'Unable to save service.'
      )
    } finally {
      setServiceSaving(false)
    }
  }

  const loadSourceAnalytics = useCallback(async (workspaceId) => {
    const requestId = ++sourceAnalyticsRequest.current

    setSourceAnalytics({})
    setSourceAnalyticsError('')

    if (!workspaceId) {
      setSourceAnalyticsLoading(false)
      return
    }

    setSourceAnalyticsLoading(true)

    try {
      const data = await fetchSourceAnalytics(workspaceId, {
        days: 30,
      })

      if (requestId !== sourceAnalyticsRequest.current) return

      setSourceAnalytics(data)
    } catch (error) {
      if (requestId === sourceAnalyticsRequest.current) {
        console.error('Source analytics error:', error)
        setSourceAnalyticsError(
          error?.message || 'Unable to load source analytics.'
        )
      }
    } finally {
      if (requestId === sourceAnalyticsRequest.current) {
        setSourceAnalyticsLoading(false)
      }
    }
  }, [])

  const loadSearchProfile = useCallback(async (workspaceId) => {
    const requestId = ++searchSettingsRequest.current

    setSearchProfile(null)
    setSearchQueries([])
    setTargetCountries([])
    setMinIntentLevel(3)
    setMaxAgeHours(72)
    setAiQueryGenerationEnabled(true)
    setAiSuggestedQueries([])
    setAiQueriesGeneratedAt(null)
    setQueryBatchSize(10)
    setEnabledSources(['google'])
    setFreelancerResultLimit(10)
    setSearchSettingsError('')
    setSearchSettingsMessage('')

    if (!workspaceId) {
      setSearchSettingsLoading(false)
      return
    }

    setSearchSettingsLoading(true)

    try {
      const data = await fetchActiveSearchProfile(workspaceId)

      if (requestId !== searchSettingsRequest.current) return
      if (!data) return

      const loadedIntentLevel = Number(data.min_intent_level)
      const loadedMaxAgeHours = Number(data.max_age_hours)
      const loadedBatchSize = Number(data.query_batch_size)
      const loadedSources = normalizeSourceKeys(data.enabled_sources)
      const loadedSourcePreferences = normalizeSourcePreferences(
        data.source_preferences
      )

      setSearchProfile(data)
      setSearchQueries(normalizeSearchList(data.search_queries))
      setTargetCountries(normalizeSearchList(data.target_countries))
      setMinIntentLevel(
        Number.isInteger(loadedIntentLevel) &&
          loadedIntentLevel >= 1 &&
          loadedIntentLevel <= 5
          ? loadedIntentLevel
          : 3
      )
      setMaxAgeHours(
        [24, 48, 72, 168].includes(loadedMaxAgeHours)
          ? loadedMaxAgeHours
          : 72
      )
      setAiQueryGenerationEnabled(
        data.ai_query_generation_enabled !== false
      )
      setAiSuggestedQueries(
        normalizeSearchList(data.ai_suggested_queries)
      )
      setAiQueriesGeneratedAt(data.ai_queries_generated_at || null)
      setQueryBatchSize(
        [5, 10, 20].includes(loadedBatchSize)
          ? loadedBatchSize
          : 10
      )
      setEnabledSources(
        FREELANCER_PRODUCTION_ENABLED
          ? loadedSources
          : loadedSources.filter((source) => source !== 'freelancer')
      )
      setFreelancerResultLimit(
        loadedSourcePreferences.freelancer.result_limit
      )
    } catch (error) {
      if (requestId === searchSettingsRequest.current) {
        console.error('Search profile error:', error)
        setSearchSettingsError(
          error?.message || 'Unable to load search settings.'
        )
      }
    } finally {
      if (requestId === searchSettingsRequest.current) {
        setSearchSettingsLoading(false)
      }
    }
  }, [])

  const saveSearchSettings = async () => {
    if (searchSettingsSavePendingRef.current || searchSettingsLoading) return

    setSearchSettingsError('')
    setSearchSettingsMessage('')

    if (
      !workspace?.id ||
      !searchProfile?.id ||
      searchProfile.workspace_id !== workspace.id
    ) {
      setSearchSettingsError('No active search profile was found for this workspace.')
      return
    }

    const cleanQueries = normalizeSearchList(searchQueries)
    const cleanCountries = normalizeSearchList(targetCountries)
    const intentLevel = Number(minIntentLevel)
    const freshnessHours = Number(maxAgeHours)
    const batchSize = Number(queryBatchSize)
    const cleanSources = normalizeSourceKeys(enabledSources)
    const sourcePreferences = normalizeSourcePreferences({
      freelancer: {
        result_limit: freelancerResultLimit,
      },
    })

    if (cleanSources.length === 0) {
      setSearchSettingsError('Enable at least one opportunity source before saving.')
      return
    }

    if (
      cleanSources.includes('freelancer') &&
      !FREELANCER_PRODUCTION_ENABLED
    ) {
      setSearchSettingsError(
        'Freelancer is verified in sandbox only. Production Freelancer search is not enabled in this deployment.'
      )
      return
    }

    if (cleanQueries.length === 0) {
      setSearchSettingsError('Add at least one search query before saving.')
      return
    }

    if (cleanCountries.length === 0) {
      setSearchSettingsError('Select at least one target country before saving.')
      return
    }

    if (!Number.isInteger(intentLevel) || intentLevel < 1 || intentLevel > 5) {
      setSearchSettingsError('Select a valid minimum intent level.')
      return
    }

    if (![24, 48, 72, 168].includes(freshnessHours)) {
      setSearchSettingsError('Select a valid opportunity freshness window.')
      return
    }

    if (![5, 10, 20].includes(batchSize)) {
      setSearchSettingsError('Select a valid query batch size.')
      return
    }

    const requestId = searchSettingsRequest.current
    const profileId = searchProfile.id
    searchSettingsSavePendingRef.current = true
    setSearchSettingsSaving(true)

    try {
      const data = await saveActiveSearchProfile({
        profileId,
        workspaceId: workspace.id,
        searchQueries: cleanQueries,
        targetCountries: cleanCountries,
        minIntentLevel: intentLevel,
        maxAgeHours: freshnessHours,
        aiQueryGenerationEnabled,
        queryBatchSize: batchSize,
        enabledSources: cleanSources,
        sourcePreferences,
      })

      if (requestId !== searchSettingsRequest.current) return
      if (!data?.id || data.id !== profileId || data.workspace_id !== workspace.id) {
        throw new Error('Search settings could not be confirmed.')
      }

      setSearchProfile(data)
      setSearchQueries(cleanQueries)
      setTargetCountries(cleanCountries)
      setMinIntentLevel(intentLevel)
      setMaxAgeHours(freshnessHours)
      setAiQueryGenerationEnabled(data.ai_query_generation_enabled !== false)
      setAiSuggestedQueries(normalizeSearchList(data.ai_suggested_queries))
      setAiQueriesGeneratedAt(data.ai_queries_generated_at || null)
      setQueryBatchSize(
        [5, 10, 20].includes(Number(data.query_batch_size))
          ? Number(data.query_batch_size)
          : batchSize
      )
      setEnabledSources(normalizeSourceKeys(data.enabled_sources))
      setFreelancerResultLimit(
        normalizeSourcePreferences(data.source_preferences)
          .freelancer.result_limit
      )
      setSearchSettingsMessage('Search settings saved.')
      console.log('Search settings saved:', data)
    } catch (error) {
      if (requestId === searchSettingsRequest.current) {
        console.error('Failed to save search settings:', error)
        setSearchSettingsError(
          error?.message || 'Unable to save search settings.'
        )
      }
    } finally {
      searchSettingsSavePendingRef.current = false
      if (requestId === searchSettingsRequest.current) {
        setSearchSettingsSaving(false)
      }
    }
  }

  const loadReviewQueue = useCallback(async (workspaceId) => {
    const requestId = ++reviewQueueRequest.current
    setReviewQueue([])
    setReviewQueueError('')

    if (!workspaceId) {
      setReviewQueueLoading(false)
      return
    }

    setReviewQueueLoading(true)

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          workspace_id,
          title,
          source,
          source_url,
          person_name,
          company_name,
          company_website,
          country,
          requirement,
          matched_service_id,
          total_score,
          score_confidence,
          recommended_action,
          why_relevant,
          recommended_portfolio_id,
          portfolio_match_reason,
          outreach_status,
          outreach_review_status,
          outreach_channel,
          outreach_subject,
          outreach_message,
          outreach_angle,
          outreach_generated_at,
          research_status,
          research_summary,
          final_scored_at
        `)
        .eq('workspace_id', workspaceId)
        .neq('outreach_status', 'not_generated')
        .eq('outreach_review_status', 'pending_review')
        .order('total_score', { ascending: false })
        .order('outreach_generated_at', { ascending: false })

      if (requestId !== reviewQueueRequest.current) return
      if (error) throw error

      console.log('Review queue:', data ?? [])
      setReviewQueue(data ?? [])
    } catch (error) {
      if (requestId === reviewQueueRequest.current) {
        console.error('Review queue error:', error)
        setReviewQueueError(error?.message || 'Unable to load the review queue.')
      }
    } finally {
      if (requestId === reviewQueueRequest.current) {
        setReviewQueueLoading(false)
      }
    }
  }, [])

  const loadApprovedOutreach = useCallback(async (workspaceId) => {
    const requestId = ++approvedOutreachRequest.current
    setApprovedOutreach([])
    setApprovedOutreachError('')

    if (!workspaceId) {
      setApprovedOutreachLoading(false)
      return
    }

    setApprovedOutreachLoading(true)

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          workspace_id,
          title,
          source,
          source_url,
          total_score,
          outreach_status,
          outreach_review_status,
          outreach_channel,
          outreach_subject,
          outreach_message,
          outreach_reviewed_at
        `)
        .eq('workspace_id', workspaceId)
        .eq('outreach_review_status', 'approved')
        .in('outreach_status', ['drafted', 'edited'])
        .order('outreach_reviewed_at', { ascending: false })
        .order('total_score', { ascending: false })

      if (requestId !== approvedOutreachRequest.current) return
      if (error) throw error

      setApprovedOutreach(data ?? [])
    } catch (error) {
      if (requestId === approvedOutreachRequest.current) {
        console.error('Approved outreach error:', error)
        setApprovedOutreachError(
          error?.message || 'Unable to load approved outreach.'
        )
      }
    } finally {
      if (requestId === approvedOutreachRequest.current) {
        setApprovedOutreachLoading(false)
      }
    }
  }, [])

  const addApprovedOutreach = (lead, changes) => {
    const approvedLead = { ...lead, ...changes }

    setApprovedOutreach((current) => [
      approvedLead,
      ...current.filter((item) => item.id !== lead.id),
    ])
  }

  const submitReviewDecision = async (lead, changes, successLabel, onSuccess) => {
    if (reviewActionPendingRef.current || reviewQueueLoading) return

    if (!workspace?.id || !lead?.id || lead.workspace_id !== workspace.id) {
      setReviewActionError({ id: lead?.id, message: 'Opportunity workspace could not be verified.' })
      return
    }

    const requestId = reviewQueueRequest.current
    const pendingAction = { id: lead.id }
    reviewActionPendingRef.current = pendingAction
    setReviewActionId(lead.id)
    setReviewActionError(null)

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .update(changes)
        .eq('id', lead.id)
        .eq('workspace_id', workspace.id)
        .neq('outreach_status', 'not_generated')
        .eq('outreach_review_status', 'pending_review')
        .select('id')
        .single()

      if (requestId !== reviewQueueRequest.current) return
      if (error) throw error
      if (data?.id !== lead.id) throw new Error('Opportunity is no longer waiting for review.')

      setReviewQueue((current) => current.filter((item) => item.id !== lead.id))
      onSuccess?.()
      console.log(`${successLabel}:`, lead.id)
    } catch (error) {
      if (requestId === reviewQueueRequest.current) {
        console.error(`${successLabel} failed:`, error)
        setReviewActionError({ id: lead.id, message: error?.message || 'Unable to update this opportunity.' })
      }
    } finally {
      if (reviewActionPendingRef.current === pendingAction) {
        reviewActionPendingRef.current = null
        if (requestId === reviewQueueRequest.current) setReviewActionId(null)
      }
    }
  }

  const approveOpportunity = async (lead) => {
    const changes = {
      outreach_review_status: 'approved',
      outreach_reviewed_at: new Date().toISOString(),
    }

    await submitReviewDecision(
      lead,
      changes,
      'Opportunity approved',
      () => {
        addApprovedOutreach(lead, changes)
        setOpportunities((current) => current.map((item) =>
          item.id === lead.id ? { ...item, ...changes } : item
        ))
        setSelectedOpportunity((current) =>
          current?.id === lead.id ? { ...current, ...changes } : current
        )
      },
    )
  }

  const startEditing = (lead) => {
    if (reviewActionPendingRef.current || editingId !== null) return

    setReviewActionError(null)
    setEditingId(lead.id)
    setEditedMessage(lead.outreach_message || '')
    setEditedSubject(lead.outreach_subject || '')
  }

  const cancelEditing = () => {
    if (reviewActionPendingRef.current) return

    setEditingId(null)
    setEditedMessage('')
    setEditedSubject('')
    setRejectingOpportunity(null)
    setRejectionReason('')
    setRejectionNote('')
    setReviewActionError(null)
  }

  const saveEditedOpportunity = async (lead) => {
    if (editingId !== lead.id) return

    const message = editedMessage.trim()
    if (!message) {
      setReviewActionError({ id: lead.id, message: 'Outreach message cannot be empty.' })
      return
    }

    const changes = {
      outreach_message: message,
      outreach_status: 'edited',
      outreach_review_status: 'approved',
      outreach_reviewed_at: new Date().toISOString(),
    }

    if (lead.outreach_subject != null) {
      changes.outreach_subject = editedSubject.trim() || null
    }

    await submitReviewDecision(lead, changes, 'Edited outreach approved', () => {
      setOpportunities((current) => current.map((item) =>
        item.id === lead.id ? { ...item, ...changes } : item
      ))
      setSelectedOpportunity((current) =>
        current?.id === lead.id ? { ...current, ...changes } : current
      )
      setEditingId(null)
      setEditedMessage('')
      setEditedSubject('')
      addApprovedOutreach(lead, changes)
    })
  }

  const startRejecting = (lead) => {
    if (reviewActionPendingRef.current || editingId !== null) return

    setReviewActionError(null)
    setRejectingOpportunity(lead)
    setRejectionReason('')
    setRejectionNote('')
  }

  const cancelRejecting = () => {
    if (reviewActionPendingRef.current) return

    setRejectingOpportunity(null)
    setRejectionReason('')
    setRejectionNote('')
    setReviewActionError(null)
  }

  const rejectOpportunity = async () => {
    const lead = rejectingOpportunity
    if (
      !lead ||
      !rejectionReason ||
      reviewActionPendingRef.current ||
      editingId !== null
    ) return

    const changes = {
      outreach_review_status: 'rejected',
      outreach_rejection_reason: rejectionReason,
      outreach_review_note: rejectionNote.trim() || null,
      outreach_reviewed_at: new Date().toISOString(),
    }

    await submitReviewDecision(lead, changes, 'Opportunity rejected', () => {
      setOpportunities((current) => current.map((item) =>
        item.id === lead.id ? { ...item, ...changes } : item
      ))
      setSelectedOpportunity((current) =>
        current?.id === lead.id ? { ...current, ...changes } : current
      )
      setRejectingOpportunity(null)
      setRejectionReason('')
      setRejectionNote('')
    })
  }

  const copyApprovedMessage = async (lead) => {
    if (!lead?.outreach_message) return

    try {
      await navigator.clipboard.writeText(lead.outreach_message)
      setCopiedOutreachId(lead.id)

      setTimeout(() => {
        setCopiedOutreachId((current) => current === lead.id ? null : current)
      }, 1800)
    } catch (error) {
      console.error('Unable to copy approved outreach:', error)
      setSendActionError({
        id: lead.id,
        message: 'Unable to copy the message. Please try again.',
      })
    }
  }

  const markOutreachAsSent = async (lead) => {
    if (sendActionPendingRef.current || approvedOutreachLoading) return

    if (!workspace?.id || !lead?.id || lead.workspace_id !== workspace.id) {
      setSendActionError({
        id: lead?.id,
        message: 'Opportunity workspace could not be verified.',
      })
      return
    }

    const requestId = approvedOutreachRequest.current
    const pendingAction = { id: lead.id }
    const sentAt = new Date().toISOString()

    sendActionPendingRef.current = pendingAction
    setSendActionId(lead.id)
    setSendActionError(null)

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .update({
          outreach_status: 'sent',
          outreach_sent_at: sentAt,
        })
        .eq('id', lead.id)
        .eq('workspace_id', workspace.id)
        .eq('outreach_review_status', 'approved')
        .in('outreach_status', ['drafted', 'edited'])
        .select('id, outreach_status, outreach_sent_at')
        .single()

      if (requestId !== approvedOutreachRequest.current) return
      if (error) throw error
      if (data?.id !== lead.id) {
        throw new Error('Outreach is no longer ready to send.')
      }

      const sentChanges = {
        outreach_status: data.outreach_status,
        outreach_sent_at: data.outreach_sent_at,
      }

      setApprovedOutreach((current) =>
        current.filter((item) => item.id !== lead.id)
      )
      setOpportunities((current) => current.map((item) =>
        item.id === lead.id ? { ...item, ...sentChanges } : item
      ))
      setSelectedOpportunity((current) =>
        current?.id === lead.id ? { ...current, ...sentChanges } : current
      )
      console.log('Outreach marked as sent:', lead.id)
    } catch (error) {
      if (requestId === approvedOutreachRequest.current) {
        console.error('Mark outreach as sent failed:', error)
        setSendActionError({
          id: lead.id,
          message: error?.message || 'Unable to mark this outreach as sent.',
        })
      }
    } finally {
      if (sendActionPendingRef.current === pendingAction) {
        sendActionPendingRef.current = null
        if (requestId === approvedOutreachRequest.current) {
          setSendActionId(null)
        }
      }
    }
  }

  const loadOpportunityActivity = async (opportunityId) => {
    if (!opportunityId) {
      setOpportunityActivity([])
      return
    }

    setActivityLoading(true)

    const { data, error } = await supabase
      .from('opportunity_activity')
      .select(`
        id,
        activity_type,
        from_status,
        to_status,
        note,
        created_at
      `)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Unable to load activity:', error)
      setOpportunityActivity([])
    } else {
      setOpportunityActivity(data || [])
    }

    setActivityLoading(false)
  }

  const updateOpportunityStatus = async (opportunityId, newStatus) => {
    setDataError('')

    const existingOpportunity = opportunities.find(
      (item) => item.id === opportunityId
    )

    const previousStatus = existingOpportunity?.status || 'new'

    const { data, error } = await supabase
      .from('opportunities')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)
      .select('id, workspace_id, status, updated_at')
      .single()

    if (error) {
      console.error('Status update error:', error)
      setDataError(error.message)
      return false
    }

    const { error: activityError } = await supabase
      .from('opportunity_activity')
      .insert({
        workspace_id: data.workspace_id,
        opportunity_id: opportunityId,
        user_id: user.id,
        activity_type: 'status_change',
        from_status: previousStatus,
        to_status: newStatus,
      })

    if (activityError) {
      console.error('Activity log error:', activityError)
    } else {
      await loadOpportunityActivity(opportunityId)
    }

    // Update dashboard cards immediately
    setOpportunities((current) =>
      current.map((item) =>
        item.id === opportunityId
          ? {
              ...item,
              status: data.status,
              updated_at: data.updated_at,
            }
          : item
      )
    )

    // Update currently opened drawer immediately
    setSelectedOpportunity((current) => {
      if (!current || current.id !== opportunityId) {
        return current
      }

      return {
        ...current,
        status: data.status,
        updated_at: data.updated_at,
      }
    })

    return true
  }

  const addOpportunityNote = async (opportunityId, note) => {
    const cleanNote = note?.trim()

    if (!opportunityId || !cleanNote || !user?.id) {
      return {
        success: false,
        error: 'Missing opportunity, note, or user information.',
      }
    }

    const existingOpportunity = opportunities.find(
      (item) => item.id === opportunityId
    )

    if (!existingOpportunity) {
      return {
        success: false,
        error: 'Opportunity could not be found.',
      }
    }

    const { error } = await supabase.from('opportunity_activity').insert({
      workspace_id: existingOpportunity.workspace_id,
      opportunity_id: opportunityId,
      user_id: user.id,
      activity_type: 'note',
      from_status: null,
      to_status: null,
      note: cleanNote,
    })

    if (error) {
      console.error('Unable to add note:', error)

      return {
        success: false,
        error: error.message,
      }
    }

    await loadOpportunityActivity(opportunityId)

    return {
      success: true,
    }
  }

  const scheduleOpportunityFollowUp = async (
    opportunityId,
    followUpDate,
    followUpNote
  ) => {
    if (!opportunityId || !followUpDate || !user?.id) {
      return {
        success: false,
        error: 'Missing follow-up information.',
      }
    }

    const existingOpportunity = opportunities.find(
      (item) => item.id === opportunityId
    )

    if (!existingOpportunity) {
      return {
        success: false,
        error: 'Opportunity could not be found.',
      }
    }

    const parsedFollowUpDate = new Date(followUpDate)

    if (Number.isNaN(parsedFollowUpDate.getTime())) {
      return {
        success: false,
        error: 'Please select a valid follow-up date and time.',
      }
    }

    const followUpIso = parsedFollowUpDate.toISOString()
    const cleanFollowUpNote = followUpNote?.trim() || null

    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        next_follow_up_at: followUpIso,
        follow_up_note: cleanFollowUpNote,
      })
      .eq('id', opportunityId)

    if (updateError) {
      console.error('Unable to schedule follow-up:', updateError)

      return {
        success: false,
        error: updateError.message,
      }
    }

    const { error: activityError } = await supabase
      .from('opportunity_activity')
      .insert({
        workspace_id: existingOpportunity.workspace_id,
        opportunity_id: opportunityId,
        user_id: user.id,
        activity_type: 'follow_up_scheduled',
        from_status: null,
        to_status: null,
        note:
          cleanFollowUpNote ||
          `Follow-up scheduled for ${parsedFollowUpDate.toLocaleString()}`,
      })

    if (activityError) {
      console.error(
        'Follow-up saved, but activity history failed:',
        activityError
      )
    }

    setOpportunities((current) =>
      current.map((item) =>
        item.id === opportunityId
          ? {
              ...item,
              next_follow_up_at: followUpIso,
              follow_up_note: cleanFollowUpNote,
            }
          : item
      )
    )

    setSelectedOpportunity((current) =>
      current?.id === opportunityId
        ? {
            ...current,
            next_follow_up_at: followUpIso,
            follow_up_note: cleanFollowUpNote,
          }
        : current
    )

    await loadOpportunityActivity(opportunityId)

    return {
      success: true,
    }
  }

  const completeOpportunityFollowUp = async (opportunityId) => {
    if (!opportunityId || !user?.id) {
      return {
        success: false,
        error: 'Missing opportunity information.',
      }
    }

    const existingOpportunity = opportunities.find(
      (item) => item.id === opportunityId
    )

    if (!existingOpportunity) {
      return {
        success: false,
        error: 'Opportunity could not be found.',
      }
    }

    const previousFollowUpDate = existingOpportunity.next_follow_up_at
    const previousFollowUpNote = existingOpportunity.follow_up_note

    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        next_follow_up_at: null,
        follow_up_note: null,
      })
      .eq('id', opportunityId)

    if (updateError) {
      console.error('Unable to complete follow-up:', updateError)

      return {
        success: false,
        error: updateError.message,
      }
    }

    const { error: activityError } = await supabase
      .from('opportunity_activity')
      .insert({
        workspace_id: existingOpportunity.workspace_id,
        opportunity_id: opportunityId,
        user_id: user.id,
        activity_type: 'follow_up_completed',
        from_status: null,
        to_status: null,
        note: previousFollowUpNote
          ? `Completed follow-up: ${previousFollowUpNote}`
          : previousFollowUpDate
            ? `Completed follow-up scheduled for ${formatFollowUpDate(
                previousFollowUpDate
              )}`
            : 'Follow-up completed.',
      })

    if (activityError) {
      console.error(
        'Follow-up completed but activity log failed:',
        activityError
      )
    }

    setOpportunities((current) =>
      current.map((item) =>
        item.id === opportunityId
          ? {
              ...item,
              next_follow_up_at: null,
              follow_up_note: null,
            }
          : item
      )
    )

    setSelectedOpportunity((current) =>
      current?.id === opportunityId
        ? {
            ...current,
            next_follow_up_at: null,
            follow_up_note: null,
          }
        : current
    )

    await loadOpportunityActivity(opportunityId)

    return {
      success: true,
    }
  }

  useEffect(() => {
    if (selectedOpportunity?.id) {
      loadOpportunityActivity(selectedOpportunity.id)
    } else {
      setOpportunityActivity([])
    }
  }, [selectedOpportunity?.id])

  // -----------------------------------------------------
  // AUTH
  // -----------------------------------------------------
  useEffect(() => {
    let active = true
    let authRevision = 0
    let workspaceTimer
    let authenticatedUserId

    const applyAuthenticatedUser = (currentUser, event) => {
      const nextUserId = currentUser?.id ?? null
      setAuthLoading(false)

      // SIGNED_IN also fires when an existing session is reconfirmed on focus.
      // Keep the workspace and mounted onboarding form for the same account.
      if (authenticatedUserId === nextUserId) {
        if (event === 'USER_UPDATED' && currentUser) {
          setUser(currentUser)
        }
        return
      }

      authenticatedUserId = nextUserId
      workspaceLoadRequest.current += 1
      clearTimeout(workspaceTimer)

      setUser(currentUser)
      setWorkspace(null)
      setWorkspaceLoading(Boolean(currentUser))

      if (currentUser) {
        // Keep database work outside the synchronous auth notification.
        workspaceTimer = setTimeout(() => {
          if (active) void loadWorkspace(currentUser)
        }, 0)
      }
    }

    const loadUser = async () => {
      const revision = authRevision

      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (!active || revision !== authRevision) return

        applyAuthenticatedUser(currentUser ?? null)
      } catch (error) {
        if (!active || revision !== authRevision) return

        console.error('Unable to load authenticated user:', error)
        applyAuthenticatedUser(null)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      authRevision += 1

      if (event === 'PASSWORD_RECOVERY') {
        authenticatedUserId = session?.user?.id ?? null
        clearTimeout(workspaceTimer)
        setAuthLoading(false)
        setUser(session?.user ?? null)
        setWorkspace(null)
        setWorkspaceLoading(false)
        setAuthMode('reset-password')
        setPassword('')
        setConfirmPassword('')
        setShowPassword(false)
        setShowConfirmPassword(false)
        setAuthMessageType('success')
        setMessage('Choose a new password for your account.')
        return
      }

      applyAuthenticatedUser(session?.user ?? null, event)
    })

    return () => {
      active = false
      workspaceLoadRequest.current += 1
      clearTimeout(workspaceTimer)
      subscription.unsubscribe()
    }
  }, [loadWorkspace])

  useEffect(() => {
    if (!workspace?.id || !workspace?.onboarding_completed) {
      setOpportunities([])
      return
    }

    void fetchOpportunities(workspace.id)
  }, [workspace?.id, workspace?.onboarding_completed])

  useEffect(() => {
    searchSettingsSavePendingRef.current = false
    setSearchSettingsSaving(false)

    if (workspace?.onboarding_completed) {
      void loadBusinessProfile(workspace.id)
      void loadSearchProfile(workspace.id)
      void loadServices(workspace.id)
      void loadPortfolioItems(workspace.id)
    } else {
      void loadBusinessProfile(null)
      void loadSearchProfile(null)
      void loadServices(null)
      void loadPortfolioItems(null)
    }

    return () => {
      searchSettingsRequest.current += 1
    }
  }, [
    workspace?.id,
    workspace?.onboarding_completed,
    loadBusinessProfile,
    loadSearchProfile,
    loadServices,
    loadPortfolioItems,
    loadSourceAnalytics,
  ])

  useEffect(() => {
    if (workspace?.onboarding_completed) {
      void loadSourceAnalytics(workspace.id)
    } else {
      void loadSourceAnalytics(null)
    }

    return () => {
      sourceAnalyticsRequest.current += 1
    }
  }, [
    workspace?.id,
    workspace?.onboarding_completed,
    loadSourceAnalytics,
  ])

  useEffect(() => {
    reviewActionPendingRef.current = null
    setReviewActionId(null)
    setReviewActionError(null)
    setEditingId(null)
    setEditedMessage('')
    setEditedSubject('')

    if (workspace?.onboarding_completed) {
      void loadReviewQueue(workspace.id)
    } else {
      void loadReviewQueue(null)
    }

    return () => {
      reviewQueueRequest.current += 1
    }
  }, [workspace?.id, workspace?.onboarding_completed, loadReviewQueue])

  useEffect(() => {
    sendActionPendingRef.current = null
    setSendActionId(null)
    setSendActionError(null)
    setCopiedOutreachId(null)

    if (workspace?.onboarding_completed) {
      void loadApprovedOutreach(workspace.id)
    } else {
      void loadApprovedOutreach(null)
    }

    return () => {
      approvedOutreachRequest.current += 1
    }
  }, [workspace?.id, workspace?.onboarding_completed, loadApprovedOutreach])

  useEffect(() => {
    searchRunRequest.current += 1
    searchRunPendingRef.current = null
    setSearchRunning(false)
    setSearchMessage('')
    setSearchError('')
  }, [workspace?.id])

  useEffect(() => {
    if (!engineRun?.id || !workspace?.id) return

    void loadSourceAnalytics(workspace.id)
  }, [engineRun?.id, workspace?.id, loadSourceAnalytics])

  // -----------------------------------------------------
  // AUTH ACTIONS
  // -----------------------------------------------------
  const showCreateAccount = () => {
    if (authActionLoading) return

    setAuthMode('sign-up')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setMessage('')
  }

  const showSignIn = () => {
    if (authActionLoading) return

    setAuthMode('sign-in')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setMessage('')
  }

  const showForgotPassword = () => {
    if (authActionLoading) return

    setAuthMode('forgot-password')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setAuthMessageType('error')
    setMessage('')
  }

  const handleSignUp = async (event) => {
    event.preventDefault()

    const validationMessage = validateSignUp(email, password, confirmPassword)
    if (validationMessage) {
      setAuthMessageType('error')
      setMessage(validationMessage)
      return
    }

    setAuthActionLoading(true)
    setAuthMessageType('error')
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (error) throw error

      if (data?.session?.user) {
        setUser(data.session.user)
        setWorkspaceLoading(true)
        await loadWorkspace(data.session.user)
        return
      }

      setAuthMode('sign-in')
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
      setAuthMessageType('success')
      setMessage('Account created. Confirm your email, then sign in to start onboarding.')
    } catch (error) {
      setAuthMessageType('error')
      setMessage(error?.message || 'Unable to create your account. Please try again.')
    } finally {
      setAuthActionLoading(false)
    }
  }

  const handleSignIn = async (event) => {
    event.preventDefault()
    setAuthActionLoading(true)
    setAuthMessageType('error')
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error
    } catch (error) {
      setMessage(error?.message || 'Unable to sign in. Please try again.')
    } finally {
      setAuthActionLoading(false)
    }
  }

  const handleForgotPassword = async (event) => {
    event.preventDefault()

    if (!email.trim()) {
      setAuthMessageType('error')
      setMessage('Email is required.')
      return
    }

    setAuthActionLoading(true)
    setAuthMessageType('error')
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: window.location.origin,
        }
      )

      if (error) throw error

      setAuthMessageType('success')
      setMessage(
        'Password reset email sent. Open the link in that email to choose a new password.'
      )
    } catch (error) {
      setAuthMessageType('error')
      setMessage(
        error?.message ||
          'Unable to send the password reset email. Please try again.'
      )
    } finally {
      setAuthActionLoading(false)
    }
  }

  const handleUpdatePassword = async (event) => {
    event.preventDefault()

    if (password.length < 8) {
      setAuthMessageType('error')
      setMessage('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setAuthMessageType('error')
      setMessage('Passwords do not match.')
      return
    }

    setAuthActionLoading(true)
    setAuthMessageType('error')
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      await supabase.auth.signOut()

      workspaceLoadRequest.current += 1
      setUser(null)
      setWorkspace(null)
      setWorkspaceLoading(false)
      setAuthMode('sign-in')
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
      setAuthMessageType('success')
      setMessage('Password updated successfully. Sign in with your new password.')
    } catch (error) {
      setAuthMessageType('error')
      setMessage(
        error?.message ||
          'Unable to update your password. Please request a new reset link and try again.'
      )
    } finally {
      setAuthActionLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    workspaceLoadRequest.current += 1
    setUser(null)
    setWorkspace(null)
    setWorkspaceError('')
    setWorkspaceLoading(false)
    setOpportunities([])
  }

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))

  const getEngineRunStatus = (run) =>
    String(run?.run_status || run?.status || '').toLowerCase()

  const waitForEngineRun = async ({
    workspaceId,
    previousRunId,
    requestId,
  }) => {
    const startedWaitingAt = Date.now()
    const timeoutMs = 4 * 60 * 1000

    while (Date.now() - startedWaitingAt < timeoutMs) {
      if (requestId !== searchRunRequest.current) {
        return null
      }

      const latestRun = await getLatestEngineRun(workspaceId)

      if (requestId !== searchRunRequest.current) {
        return null
      }

      // Ignore the previous execution while waiting for this search to start.
      if (latestRun && latestRun.id !== previousRunId) {
        setEngineRun(latestRun)

        const status = getEngineRunStatus(latestRun)

        if (['completed', 'success', 'succeeded'].includes(status)) {
          return latestRun
        }

        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          const failedStep = latestRun.failed_step
            ? ` Failed step: ${latestRun.failed_step}.`
            : ''

          throw new Error(
            `${latestRun.error_message || 'Opportunity Engine failed.'}${failedStep}`
          )
        }

        setSearchMessage(
          'Opportunity Engine is running. Collecting, researching and scoring opportunities...'
        )
      } else {
        setSearchMessage(
          'Search accepted. Waiting for the Opportunity Engine to start...'
        )
      }

      await sleep(2000)
    }

    throw new Error(
      'The Opportunity Engine is taking longer than expected. The workflow may still be running in the background. Refresh the dashboard in a few moments.'
    )
  }

  const handleRegenerateAiQueries = async () => {
    if (
      aiQueriesGenerating ||
      searchRunning ||
      searchSettingsSaving ||
      !workspace?.id ||
      !searchProfile?.id
    ) {
      return
    }

    setSearchSettingsError('')
    setSearchSettingsMessage('')
    setAiQueriesGenerating(true)

    const previousGeneratedAt =
      searchProfile.ai_queries_generated_at ||
      aiQueriesGeneratedAt ||
      null

    try {
      await triggerAiQueryGeneration(workspace.id)

      setSearchSettingsMessage(
        'AI query generation started. Waiting for the new query set...'
      )

      const startedAt = Date.now()
      const timeoutMs = 60 * 1000

      while (Date.now() - startedAt < timeoutMs) {
        await sleep(1500)

        const updatedProfile = await fetchSearchProfileById({
          profileId: searchProfile.id,
          workspaceId: workspace.id,
        })

        const generatedAt = updatedProfile?.ai_queries_generated_at || null

        if (
          generatedAt &&
          generatedAt !== previousGeneratedAt
        ) {
          setSearchProfile(updatedProfile)
          setSearchQueries(
            normalizeSearchList(updatedProfile.search_queries)
          )
          setTargetCountries(
            normalizeSearchList(updatedProfile.target_countries)
          )
          setMinIntentLevel(Number(updatedProfile.min_intent_level) || 3)
          setMaxAgeHours(Number(updatedProfile.max_age_hours) || 72)
          setAiQueryGenerationEnabled(
            updatedProfile.ai_query_generation_enabled !== false
          )
          setAiSuggestedQueries(
            normalizeSearchList(updatedProfile.ai_suggested_queries)
          )
          setAiQueriesGeneratedAt(generatedAt)
          setQueryBatchSize(
            [5, 10, 20].includes(Number(updatedProfile.query_batch_size))
              ? Number(updatedProfile.query_batch_size)
              : 10
          )
          setEnabledSources(
            FREELANCER_PRODUCTION_ENABLED
              ? normalizeSourceKeys(updatedProfile.enabled_sources)
              : normalizeSourceKeys(updatedProfile.enabled_sources)
                  .filter((source) => source !== 'freelancer')
          )
          setFreelancerResultLimit(
            normalizeSourcePreferences(updatedProfile.source_preferences)
              .freelancer.result_limit
          )

          setSearchSettingsMessage(
            `AI queries regenerated successfully. ${normalizeSearchList(
              updatedProfile.ai_suggested_queries
            ).length} queries are ready, and the search rotation was reset.`
          )
          return
        }
      }

      throw new Error(
        'AI query generation was accepted but the updated query set did not appear in time. Refresh Search Settings and check again.'
      )
    } catch (error) {
      console.error('AI query regeneration failed:', error)
      setSearchSettingsError(
        error?.message || 'Unable to regenerate AI search queries.'
      )
    } finally {
      setAiQueriesGenerating(false)
    }
  }

  const handleFindOpportunities = async () => {
    if (searchRunPendingRef.current || searchSettingsSavePendingRef.current) {
      return
    }

    if (!workspace?.id) {
      setSearchMessage('')
      setSearchError(
        'Workspace not found. Please refresh and try again.'
      )
      return
    }

    const requestId = ++searchRunRequest.current
    const pendingSearch = {
      workspaceId: workspace.id,
    }

    searchRunPendingRef.current = pendingSearch

    setSearchRunning(true)
    setSearchMessage('Preparing opportunity search...')
    setSearchError('')
    setEngineRun(null)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (requestId !== searchRunRequest.current) return

      if (sessionError) {
        throw sessionError
      }

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const previousRun = await getLatestEngineRun(workspace.id)

      if (requestId !== searchRunRequest.current) return

      const previousRunId = previousRun?.id ?? null

      setSearchMessage('Starting Opportunity Engine...')

      const engineResponse = await triggerOpportunityEngine(workspace.id)

      if (requestId !== searchRunRequest.current) return

      console.log('Opportunity Engine accepted:', engineResponse)

      setSearchMessage(
        'Opportunity search accepted. Waiting for the workflow to start...'
      )

      const completedRun = await waitForEngineRun({
        workspaceId: workspace.id,
        previousRunId,
        requestId,
      })

      if (!completedRun || requestId !== searchRunRequest.current) {
        return
      }

      setEngineRun(completedRun)

      await Promise.all([
        fetchOpportunities(workspace.id),
        loadReviewQueue(workspace.id),
        loadApprovedOutreach(workspace.id),
      ])

      if (requestId !== searchRunRequest.current) return

      const processed = Number(
        completedRun.opportunities_processed || 0
      )
      const drafts = Number(completedRun.outreach_drafted || 0)

      if (processed === 0) {
        setSearchMessage(
          'Search complete. No new opportunities were processed during this run.'
        )
      } else {
        setSearchMessage(
          `Search complete. ${processed} ${
            processed === 1 ? 'opportunity' : 'opportunities'
          } processed${
            drafts > 0
              ? ` and ${drafts} outreach ${
                  drafts === 1 ? 'draft' : 'drafts'
                } generated`
              : ''
          }.`
        )
      }
    } catch (error) {
      if (requestId === searchRunRequest.current) {
        console.error('Opportunity search error:', error)
        setSearchMessage('')
        setSearchError(
          error?.message ||
            'Something went wrong while running the Opportunity Engine.'
        )
      }
    } finally {
      if (searchRunPendingRef.current === pendingSearch) {
        searchRunPendingRef.current = null

        if (requestId === searchRunRequest.current) setSearchRunning(false)
      }
    }
  }

  const handleGenerateManualPitch = async (opportunity) => {
    if (
      manualPitchId ||
      !workspace?.id ||
      !opportunity?.id ||
      opportunity.workspace_id !== workspace.id
    ) {
      return
    }

    if (
      opportunity.outreach_message ||
      (opportunity.outreach_status &&
        opportunity.outreach_status !== 'not_generated')
    ) {
      setManualPitchError({
        id: opportunity.id,
        message: 'This opportunity already has an outreach draft.',
      })
      return
    }

    setManualPitchId(opportunity.id)
    setManualPitchError(null)

    try {
      await generateOpportunityPitch({
        workspaceId: workspace.id,
        opportunityId: opportunity.id,
      })

      await Promise.all([
        fetchOpportunities(workspace.id),
        loadReviewQueue(workspace.id),
      ])

      if (selectedOpportunity?.id === opportunity.id) {
        setSelectedOpportunity((current) =>
          current?.id === opportunity.id
            ? {
                ...current,
                outreach_status: 'drafted',
                outreach_review_status: 'pending_review',
              }
            : current
        )
      }
    } catch (error) {
      console.error('Manual pitch generation failed:', error)
      setManualPitchError({
        id: opportunity.id,
        message:
          error?.message ||
          'Unable to generate outreach for this opportunity.',
      })
    } finally {
      setManualPitchId(null)
    }
  }

  const refreshDashboard = () => {
    if (
      reviewActionPendingRef.current ||
      sendActionPendingRef.current ||
      searchSettingsSavePendingRef.current ||
      editingId !== null
    ) return
    if (!workspace?.id) return

    void fetchOpportunities(workspace.id)
    void loadSearchProfile(workspace.id)
    void loadReviewQueue(workspace.id)
    void loadApprovedOutreach(workspace.id)
    void loadSourceAnalytics(workspace.id)
  }

  // -----------------------------------------------------
  // DASHBOARD CALCULATIONS
  // -----------------------------------------------------
  const stats = useMemo(() => {
    const total = opportunities.length

    const pitchReady = opportunities.filter((item) =>
      ['pitch', 'high_priority_pitch'].includes(item.recommended_action)
    ).length

    const highScore = opportunities.filter(
      (item) =>
        item.score_stage === 'final' &&
        Number(item.total_score || 0) >= 70
    ).length

    const draftsReady = opportunities.filter(
      (item) => Boolean(item.outreach_message)
    ).length

    const overdueFollowUps = opportunities.filter(
      (item) => getFollowUpState(item.next_follow_up_at) === 'overdue'
    ).length

    const dueTodayFollowUps = opportunities.filter(
      (item) => getFollowUpState(item.next_follow_up_at) === 'today'
    ).length

    const upcomingFollowUps = opportunities.filter(
      (item) => getFollowUpState(item.next_follow_up_at) === 'upcoming'
    ).length

    return {
      total,
      pitchReady,
      highScore,
      draftsReady,
      overdueFollowUps,
      dueTodayFollowUps,
      upcomingFollowUps,
    }
  }, [opportunities])

  // -----------------------------------------------------
  // FILTERED OPPORTUNITIES
  // -----------------------------------------------------
  const filteredOpportunities = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()

    return opportunities.filter((opportunity) => {
      const matchesSearch =
        !search ||
        opportunity.title?.toLowerCase().includes(search) ||
        opportunity.requirement?.toLowerCase().includes(search) ||
        opportunity.source?.toLowerCase().includes(search) ||
        opportunity.country?.toLowerCase().includes(search)

      const matchesAction =
        actionFilter === 'all' ||
        opportunity.recommended_action === actionFilter

      const score = Number(opportunity.total_score || 0)

      let matchesScore = true

      if (scoreFilter === '80+') {
        matchesScore = score >= 80
      } else if (scoreFilter === '70+') {
        matchesScore = score >= 70
      } else if (scoreFilter === '60-69') {
        matchesScore = score >= 60 && score < 70
      } else if (scoreFilter === 'below60') {
        matchesScore = score < 60
      }

      let matchesDraft = true
      const matchesStatus =
        statusFilter === 'all' ||
        (opportunity.status || 'new') === statusFilter

      const matchesFollowUp =
        followUpFilter === 'all' ||
        getFollowUpBucket(opportunity) === followUpFilter

      if (draftFilter === 'ready') {
        matchesDraft = Boolean(opportunity.outreach_message)
      } else if (draftFilter === 'missing') {
        matchesDraft = !opportunity.outreach_message
      }

      return (
        matchesSearch &&
        matchesAction &&
        matchesScore &&
        matchesDraft &&
        matchesStatus &&
        matchesFollowUp
      )
    })
  }, [
    opportunities,
    searchTerm,
    actionFilter,
    scoreFilter,
    draftFilter,
    statusFilter,
    followUpFilter,
  ])

  const followUpQueue = opportunities
    .filter((opportunity) =>
      ['overdue', 'today', 'upcoming'].includes(getFollowUpBucket(opportunity))
    )
    .sort(
      (a, b) =>
        new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at)
    )

  const visibleFollowUps = followUpQueue.slice(0, 5)

  // -----------------------------------------------------
  // LOADING SCREEN
  // -----------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Loading Opportunity Engine...</p>
      </div>
    )
  }

  // -----------------------------------------------------
  // LOGIN SCREEN
  // -----------------------------------------------------
  if (!user || authMode === 'reset-password') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <p className="text-violet-400 text-sm mb-2">Opportunity Engine</p>

          <h1 className="text-3xl font-bold mb-2">
            {authMode === 'sign-up'
              ? 'Create your account'
              : authMode === 'forgot-password'
                ? 'Reset your password'
                : authMode === 'reset-password'
                  ? 'Choose a new password'
                  : 'Welcome back'}
          </h1>

          <p className="text-slate-400 mb-8">
            {authMode === 'sign-up'
              ? 'Create your login to start setting up your opportunity workspace.'
              : authMode === 'forgot-password'
                ? 'Enter your email and we’ll send you a secure password reset link.'
                : authMode === 'reset-password'
                  ? 'Enter and confirm a new password for your Opportunity Engine account.'
                  : 'Sign in to manage opportunities and AI-generated outreach.'}
          </p>

          <form
            className="space-y-4"
            onSubmit={
              authMode === 'sign-up'
                ? handleSignUp
                : authMode === 'forgot-password'
                  ? handleForgotPassword
                  : authMode === 'reset-password'
                    ? handleUpdatePassword
                    : handleSignIn
            }
          >
            {authMode !== 'reset-password' && (
              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-sm text-slate-300 mb-2"
                >
                  Email
                </label>

                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-4 py-3 outline-none focus:border-violet-500"
                  placeholder="you@example.com"
                />
              </div>
            )}

            {authMode !== 'forgot-password' && (
              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-sm text-slate-300 mb-2"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      authMode === 'sign-up' ||
                      authMode === 'reset-password'
                        ? 'new-password'
                        : 'current-password'
                    }
                    required
                    minLength={
                      authMode === 'sign-up' ||
                      authMode === 'reset-password'
                        ? 6
                        : undefined
                    }
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 pl-4 pr-12 py-3 outline-none focus:border-violet-500"
                    placeholder="••••••••"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((isVisible) => !isVisible)
                    }
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {(authMode === 'sign-up' ||
                  authMode === 'reset-password') && (
                  <p className="mt-2 text-xs text-slate-500">
                    Use at least 6 characters.
                  </p>
                )}
              </div>
            )}

            {(authMode === 'sign-up' || authMode === 'reset-password') && (
              <div>
                <label htmlFor="confirm-password" className="block text-sm text-slate-300 mb-2">
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 pl-4 pr-12 py-3 outline-none focus:border-violet-500"
                    placeholder="••••••••"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((isVisible) => !isVisible)}
                    aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                    aria-pressed={showConfirmPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div
                role={authMessageType === 'error' ? 'alert' : 'status'}
                className={`rounded-lg border p-3 text-sm ${
                  authMessageType === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={authActionLoading}
              className="w-full bg-violet-600 hover:bg-violet-500 transition rounded-lg py-3 font-medium disabled:opacity-50"
            >
              {authActionLoading
                ? authMode === 'sign-up'
                  ? 'Creating account...'
                  : authMode === 'forgot-password'
                    ? 'Sending reset link...'
                    : authMode === 'reset-password'
                      ? 'Updating password...'
                      : 'Signing in...'
                : authMode === 'sign-up'
                  ? 'Create Account'
                  : authMode === 'forgot-password'
                    ? 'Send Reset Link'
                    : authMode === 'reset-password'
                      ? 'Update Password'
                      : 'Sign In'}
            </button>

            {authMode === 'sign-in' && (
              <button
                type="button"
                onClick={showForgotPassword}
                disabled={authActionLoading}
                className="w-full text-sm font-medium text-violet-300 transition hover:text-violet-200 disabled:opacity-50"
              >
                Forgot password?
              </button>
            )}

            <button
              type="button"
              onClick={
                authMode === 'sign-in'
                  ? showCreateAccount
                  : showSignIn
              }
              disabled={authActionLoading}
              className="w-full border border-slate-700 hover:bg-slate-800 transition rounded-lg py-3 font-medium disabled:opacity-50"
            >
              {authMode === 'sign-in'
                ? 'Create Account'
                : 'Back to Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------
  // DASHBOARD
  // -----------------------------------------------------
  if (user && workspaceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <p className="text-slate-400">Loading workspace...</p>
      </div>
    )
  }

  if (user && !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-semibold">Unable to open your workspace</h1>
          <p role="alert" className="mt-3 text-sm text-slate-400">
            {workspaceError || 'Your workspace is not available yet.'}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void loadWorkspace(user)}
              className="rounded-lg bg-violet-600 px-4 py-3 font-medium transition hover:bg-violet-500"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-lg border border-slate-700 px-4 py-3 font-medium transition hover:bg-slate-800"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (user && workspace && workspace.onboarding_completed === false) {
    return (
      <Onboarding
        user={user}
        workspace={workspace}
        onComplete={(updatedWorkspace) => {
          setWorkspace((current) => {
            if (
              !current || current.id !== updatedWorkspace.id ||
              current.owner_user_id !== updatedWorkspace.owner_user_id
            ) return current

            return { ...current, ...updatedWorkspace }
          })
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-1 text-sm font-medium text-violet-400">
                Opportunity Engine
              </p>

              <h1 className="text-3xl font-bold text-white">
                {activePage === 'dashboard'
                  ? 'Sales Dashboard'
                  : 'Settings'}
              </h1>

              <p className="mt-2 text-slate-400">
                {activePage === 'dashboard'
                  ? 'Discover, qualify and pitch relevant opportunities.'
                  : 'Manage how your Opportunity Engine discovers new business.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-2 hidden text-right md:block">
                <p className="text-xs text-slate-500">
                  Signed in as
                </p>

                <p className="max-w-55 truncate text-sm text-slate-300">
                  {user.email}
                </p>
              </div>

            {activePage === 'dashboard' && (
              <button
                type="button"
                onClick={refreshDashboard}
                disabled={
                  dataLoading ||
                  searchSettingsLoading ||
                  reviewQueueLoading ||
                  approvedOutreachLoading ||
                  searchSettingsSaving ||
                  reviewActionId !== null ||
                  sendActionId !== null ||
                  editingId !== null
                }
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800 disabled:opacity-50"
              >
                {dataLoading ||
                searchSettingsLoading ||
                reviewQueueLoading ||
                approvedOutreachLoading
                  ? 'Refreshing...'
                  : 'Refresh'}
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800"
            >
              Sign Out
            </button>
          </div>
          </div>

          <nav
            className="mt-7 flex gap-1 border-b border-slate-800"
            aria-label="Main navigation"
          >
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                activePage === 'dashboard'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => setActivePage('settings')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                activePage === 'settings'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Settings
            </button>
          </nav>
        </header>

        {activePage === 'dashboard' && (
          <>
            <section className="engine-action-card" aria-labelledby="engine-action-title">
          <div>
            <span className="engine-eyebrow">OPPORTUNITY ENGINE</span>
            <h2 id="engine-action-title">Find new opportunities</h2>
            <p>
              Search for opportunities matching the services and preferences configured in your workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleFindOpportunities()}
            disabled={searchRunning || searchSettingsSaving}
            className="find-opportunities-btn"
          >
            {searchRunning ? 'Search Running...' : 'Find Opportunities'}
          </button>

          {engineRun && searchRunning && (
            <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-violet-500"></span>
                </span>

                <div>
                  <p className="font-medium text-white">
                    Opportunity Engine is running
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Collecting, researching and scoring opportunities.
                  </p>
                </div>
              </div>
            </div>
          )}

          {searchMessage && (
            <div role="status" className="engine-success-message">
              {searchMessage}
            </div>
          )}

          {searchError && (
            <div role="alert" className="engine-error-message">
              {searchError}
            </div>
          )}
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Opportunities" value={stats.total} />
          <StatCard label="Pitch Ready" value={stats.pitchReady} />
          <StatCard label="High Score" value={stats.highScore} />
          <StatCard label="Drafts Generated" value={stats.draftsReady} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <button
            type="button"
            onClick={() =>
              setFollowUpFilter(
                followUpFilter === 'overdue' ? 'all' : 'overdue'
              )
            }
            aria-pressed={followUpFilter === 'overdue'}
            className={`w-full rounded-2xl border p-6 text-left transition ${
              followUpFilter === 'overdue'
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}
          >
            <p className="text-sm text-slate-400">Overdue Follow-ups</p>
            <p className="mt-3 text-4xl font-bold text-white">
              {stats.overdueFollowUps}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFollowUpFilter(
                followUpFilter === 'today' ? 'all' : 'today'
              )
            }
            aria-pressed={followUpFilter === 'today'}
            className={`w-full rounded-2xl border p-6 text-left transition ${
              followUpFilter === 'today'
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}
          >
            <p className="text-sm text-slate-400">Due Today</p>
            <p className="mt-3 text-4xl font-bold text-white">
              {stats.dueTodayFollowUps}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFollowUpFilter(
                followUpFilter === 'upcoming' ? 'all' : 'upcoming'
              )
            }
            aria-pressed={followUpFilter === 'upcoming'}
            className={`w-full rounded-2xl border p-6 text-left transition ${
              followUpFilter === 'upcoming'
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
            }`}
          >
            <p className="text-sm text-slate-400">Upcoming</p>
            <p className="mt-3 text-4xl font-bold text-white">
              {stats.upcomingFollowUps}
            </p>
          </button>
        </div>

        {/* Error */}
        {dataError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4">
            <p className="font-medium">Unable to load opportunities</p>
            <p className="text-sm mt-1">{dataError}</p>
          </div>
        )}

        {visibleFollowUps.length > 0 && (
          <section className="mt-8 mb-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Follow-up Queue
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Your next sales actions in priority order.
                </p>
              </div>

              <span className="text-sm text-slate-400">
                {followUpQueue.length} scheduled
              </span>
            </div>

            <div className="divide-y divide-slate-800">
              {visibleFollowUps.map((opportunity) => {
                const bucket = getFollowUpBucket(opportunity)

                return (
                  <div
                    key={opportunity.id}
                    className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                            bucket === 'overdue'
                              ? 'border-red-500/30 bg-red-500/10 text-red-300'
                              : bucket === 'today'
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                          }`}
                        >
                          {bucket === 'overdue'
                            ? 'Overdue'
                            : bucket === 'today'
                              ? 'Due Today'
                              : 'Upcoming'}
                        </span>

                        <span className="text-sm text-slate-400">
                          {formatFollowUpDate(opportunity.next_follow_up_at)}
                        </span>
                      </div>

                      <h3 className="truncate text-base font-semibold text-white">
                        {opportunity.title || 'Untitled opportunity'}
                      </h3>

                      {opportunity.follow_up_note && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                          {opportunity.follow_up_note}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedOpportunity(opportunity)}
                      className="shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:border-violet-500 hover:bg-violet-500/10"
                    >
                      View Details
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Review Queue</h2>
          <p className="mt-1 text-sm text-slate-400">
            Pitch drafts waiting for your review.
          </p>

          {reviewQueueLoading ? (
            <p role="status" className="mt-6 text-slate-400">Loading opportunities...</p>
          ) : reviewQueueError ? (
            <div role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              <p>Unable to load the review queue: {reviewQueueError}</p>
              <button
                type="button"
                onClick={() => void loadReviewQueue(workspace?.id)}
                className="mt-3 text-sm font-medium underline hover:text-white"
              >
                Retry
              </button>
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-5">
              <h3 className="font-medium">No opportunities waiting for review</h3>
              <p className="mt-1 text-sm text-slate-400">
                New pitch-ready opportunities will appear here after the Opportunity Engine runs.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {reviewQueue.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-slate-800 bg-slate-950 p-5">
                  <h3 className="font-semibold">{lead.title || 'Untitled opportunity'}</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Score: <strong className="text-white">{lead.total_score ?? '—'}</strong>
                  </p>
                  <p className="text-sm text-slate-400">Action: {lead.recommended_action || '—'}</p>
                  <p className="text-sm text-slate-400">Channel: {lead.outreach_channel || '—'}</p>
                  {lead.why_relevant && <p className="mt-3 text-sm text-slate-300">{lead.why_relevant}</p>}
                  <hr className="my-4 border-slate-800" />
                  <strong className="text-sm">AI Draft</strong>
                  {editingId === lead.id ? (
                    <div className="mt-3 space-y-3">
                      {lead.outreach_subject !== null && (
                        <label className="block text-sm text-slate-300">
                          Subject
                          <input
                            type="text"
                            value={editedSubject}
                            onChange={(event) => setEditedSubject(event.target.value)}
                            disabled={reviewActionId !== null}
                            placeholder="Subject"
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-violet-500 disabled:opacity-50"
                          />
                        </label>
                      )}
                      <label className="block text-sm text-slate-300">
                        Message
                        <textarea
                          value={editedMessage}
                          onChange={(event) => setEditedMessage(event.target.value)}
                          disabled={reviewActionId !== null}
                          rows={8}
                          className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-violet-500 disabled:opacity-50"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEditedOpportunity(lead)}
                          disabled={reviewActionId !== null || !editedMessage.trim()}
                          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reviewActionId === lead.id ? 'Saving...' : 'Save & Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={reviewActionId !== null}
                          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {lead.outreach_subject && (
                        <p className="mt-2 text-sm text-slate-300">Subject: {lead.outreach_subject}</p>
                      )}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                        {lead.outreach_message || 'No draft message available.'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void approveOpportunity(lead)}
                          disabled={reviewActionId !== null || editingId !== null}
                          className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reviewActionId === lead.id ? 'Saving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditing(lead)}
                          disabled={reviewActionId !== null || editingId !== null}
                          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => startRejecting(lead)}
                          disabled={reviewActionId !== null || editingId !== null}
                          className="rounded-lg border border-rose-800 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </>
                  )}
                  {reviewActionError?.id === lead.id && (
                    <p role="alert" className="mt-3 text-sm text-red-300">
                      {reviewActionError.message}
                    </p>
                  )}
                  {lead.source_url && /^https?:\/\//i.test(lead.source_url) && (
                    <a
                      href={lead.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-sm text-violet-300 underline hover:text-violet-200"
                    >
                      View Source
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Approved Outreach</h2>
              <p className="mt-1 text-sm text-slate-400">
                Reviewed messages ready for you to send.
              </p>
            </div>

            {!approvedOutreachLoading && !approvedOutreachError && (
              <span className="text-sm text-slate-400">
                {approvedOutreach.length} ready
              </span>
            )}
          </div>

          {approvedOutreachLoading ? (
            <p role="status" className="mt-6 text-slate-400">
              Loading approved outreach...
            </p>
          ) : approvedOutreachError ? (
            <div role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              <p>Unable to load approved outreach: {approvedOutreachError}</p>
              <button
                type="button"
                onClick={() => void loadApprovedOutreach(workspace?.id)}
                className="mt-3 text-sm font-medium underline hover:text-white"
              >
                Retry
              </button>
            </div>
          ) : approvedOutreach.length === 0 ? (
            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-5">
              <h3 className="font-medium">No approved outreach ready to send</h3>
              <p className="mt-1 text-sm text-slate-400">
                Approve a draft in the review queue and it will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {approvedOutreach.map((lead) => {
                const hasSourceUrl = Boolean(
                  lead.source_url && /^https?:\/\//i.test(lead.source_url)
                )

                return (
                  <article
                    key={lead.id}
                    className="flex min-w-0 flex-col rounded-lg border border-slate-800 bg-slate-950 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white">
                          {lead.title || 'Untitled opportunity'}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                            {lead.source || 'Unknown source'}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                            {lead.outreach_channel || 'Channel not set'}
                          </span>
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                            Ready to send
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-center text-violet-200">
                        <p className="text-xs text-violet-300">Score</p>
                        <p className="mt-0.5 text-lg font-bold">
                          {Number(lead.total_score || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex-1 border-t border-slate-800 pt-4">
                      {lead.outreach_subject && (
                        <p className="mb-3 text-sm font-medium text-white">
                          {lead.outreach_subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {lead.outreach_message || 'No approved message available.'}
                      </p>
                    </div>

                    {sendActionError?.id === lead.id && (
                      <p role="alert" className="mt-4 text-sm text-red-300">
                        {sendActionError.message}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                      <button
                        type="button"
                        onClick={() => void copyApprovedMessage(lead)}
                        disabled={!lead.outreach_message || sendActionId !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Clipboard className="h-4 w-4" aria-hidden="true" />
                        {copiedOutreachId === lead.id ? 'Copied' : 'Copy Message'}
                      </button>

                      {hasSourceUrl ? (
                        <a
                          href={lead.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open Source
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 opacity-50"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open Source
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void markOutreachAsSent(lead)}
                        disabled={sendActionId !== null}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {sendActionId === lead.id ? 'Marking Sent...' : 'Mark as Sent'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {rejectingOpportunity && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-outreach-title"
              aria-describedby="reject-outreach-description"
              className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-start justify-between gap-5">
                <div>
                  <h3 id="reject-outreach-title" className="text-xl font-semibold text-white">
                    Reject outreach
                  </h3>
                  <p id="reject-outreach-description" className="mt-1 text-sm text-slate-400">
                    Why are you rejecting this draft for{' '}
                    <span className="text-slate-300">
                      {rejectingOpportunity.title || 'this opportunity'}
                    </span>
                    ?
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelRejecting}
                  disabled={reviewActionId !== null}
                  aria-label="Close rejection dialog"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <fieldset disabled={reviewActionId !== null}>
                <legend className="mb-3 text-sm font-medium text-slate-200">
                  Rejection reason
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REJECTION_REASONS.map(([value, label], index) => (
                    <button
                      key={value}
                      type="button"
                      autoFocus={index === 0}
                      aria-pressed={rejectionReason === value}
                      onClick={() => setRejectionReason(value)}
                      className={`rounded-lg border px-4 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        rejectionReason === value
                          ? 'border-rose-500 bg-rose-500/10 text-rose-200'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label htmlFor="rejection-note" className="mt-5 block text-sm font-medium text-slate-200">
                  Additional note <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="rejection-note"
                  value={rejectionNote}
                  onChange={(event) => setRejectionNote(event.target.value)}
                  placeholder="Optional details..."
                  rows={4}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-violet-500 disabled:opacity-50"
                />
              </fieldset>

              {reviewActionError?.id === rejectingOpportunity.id && (
                <p role="alert" className="mt-4 text-sm text-red-300">
                  {reviewActionError.message}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelRejecting}
                  disabled={reviewActionId !== null}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void rejectOpportunity()}
                  disabled={!rejectionReason || reviewActionId !== null}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewActionId === rejectingOpportunity.id
                    ? 'Rejecting...'
                    : 'Reject Outreach'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Opportunities */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Opportunities</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Ranked by final opportunity score.
                </p>
              </div>

              <span className="text-sm text-slate-400">
                {filteredOpportunities.length} found
              </span>
            </div>
          </div>

          <FilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            actionFilter={actionFilter}
            setActionFilter={setActionFilter}
            scoreFilter={scoreFilter}
            setScoreFilter={setScoreFilter}
            draftFilter={draftFilter}
            setDraftFilter={setDraftFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            followUpFilter={followUpFilter}
            setFollowUpFilter={setFollowUpFilter}
          />

          {dataLoading ? (
            <div className="p-10 text-center text-slate-400">
              Loading opportunities...
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-300 font-medium">
                No opportunities match the current filters.
              </p>
              <p className="text-slate-500 text-sm mt-2">
                Try changing the search text or filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  onViewDetails={() => setSelectedOpportunity(opportunity)}
                  onGeneratePitch={() =>
                    void handleGenerateManualPitch(opportunity)
                  }
                  pitchGenerating={manualPitchId === opportunity.id}
                  pitchDisabled={
                    manualPitchId !== null &&
                    manualPitchId !== opportunity.id
                  }
                  pitchError={
                    manualPitchError?.id === opportunity.id
                      ? manualPitchError.message
                      : ''
                  }
                />
              ))}
            </div>
          )}
        </div>
        <OpportunityDrawer
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
          onUpdateStatus={updateOpportunityStatus}
          onAddNote={addOpportunityNote}
          onScheduleFollowUp={scheduleOpportunityFollowUp}
          onCompleteFollowUp={completeOpportunityFollowUp}
          opportunityActivity={opportunityActivity}
          activityLoading={activityLoading}
        />
          </>
        )}

        {activePage === 'settings' && (
          <div className="space-y-8">
            <section className="settings-section">
              <div className="settings-section-header">
                <div>
                  <span className="settings-eyebrow">BUSINESS PROFILE</span>
                  <h2>Business Profile</h2>
                  <p>
                    Keep the business context used to qualify and prioritize opportunities up to date.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openBusinessProfileEditor}
                  disabled={businessProfileLoading || !businessProfile}
                  className="secondary-btn"
                >
                  Edit Profile
                </button>
              </div>

              {businessProfileLoading && (
                <p>Loading business profile...</p>
              )}

              {businessProfileError && !businessProfileEditorOpen && (
                <div role="alert" className="settings-error-message">
                  {businessProfileError}
                </div>
              )}

              {businessProfileMessage && !businessProfileEditorOpen && (
                <div role="status" className="settings-success-message">
                  {businessProfileMessage}
                </div>
              )}

              {!businessProfileLoading && !businessProfileError && !businessProfile && (
                <div className="empty-settings-state">
                  No business profile configured yet.
                </div>
              )}

              {businessProfile && (
                <dl className="mt-6 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Business</dt>
                    <dd className="mt-1 text-sm font-medium text-white">
                      {businessProfile.business_name || 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Type</dt>
                    <dd className="mt-1 text-sm capitalize text-slate-300">
                      {businessProfile.business_type || 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Language</dt>
                    <dd className="mt-1 text-sm text-slate-300">
                      {businessProfile.preferred_language || 'Not set'}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="settings-section">
              <div className="settings-section-header">
                <div>
                  <span className="settings-eyebrow">SERVICES</span>
                  <h2>Your Services</h2>
                  <p>
                    The Opportunity Engine uses these services to understand
                    which opportunities are relevant to your business.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddService}
                  className="secondary-btn"
                >
                  + Add Service
                </button>
              </div>

              {servicesLoading && (
                <p>Loading services...</p>
              )}

              {servicesError && (
                <div role="alert" className="settings-error-message">
                  {servicesError}
                </div>
              )}

              {!servicesLoading && !servicesError && services.length === 0 && (
                <div className="empty-settings-state">
                  No services configured yet.
                </div>
              )}

              <div className="service-settings-grid">
                {services.map((service) => (
                  <article
                    key={service.id}
                    className="service-settings-card"
                  >
                    <div className="service-card-heading">
                      <div>
                        <h3>{service.name}</h3>

                        <span
                          className={
                            service.active
                              ? 'service-status active'
                              : 'service-status inactive'
                          }
                        >
                          {service.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="service-card-actions">
                        <strong>
                          {service.currency === 'INR' ? '₹' : service.currency}
                          {Number(service.min_project_value || 0).toLocaleString()}
                        </strong>

                        <button
                          type="button"
                          className="service-edit-btn"
                          onClick={() => handleEditService(service)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <p>{service.description}</p>

                    {Array.isArray(service.keywords) &&
                      service.keywords.length > 0 && (
                        <div className="service-keywords">
                          {service.keywords.map((keyword) => (
                            <span key={keyword}>
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                  </article>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-header">
                <div>
                  <span className="settings-eyebrow">PROOF &amp; PROFILES</span>
                  <h2>Proof &amp; Profiles</h2>
                  <p>
                    Add profiles, work samples, case studies, publications or other evidence AI can use when matching opportunities and writing outreach.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openNewPortfolio}
                  className="secondary-btn"
                >
                  + Add Proof / Profile
                </button>
              </div>

              {portfolioLoading && (
                <p>Loading proof & profiles...</p>
              )}

              {portfolioError && (
                <div role="alert" className="settings-error-message">
                  {portfolioError}
                </div>
              )}

              {!portfolioLoading && !portfolioError && portfolioItems.length === 0 && (
                <div className="empty-settings-state">
                  No proof or profile links configured yet.
                </div>
              )}

              <div className="service-settings-grid">
                {portfolioItems.map((item) => (
                  <article
                    key={item.id}
                    className="service-settings-card"
                  >
                    <div className="service-card-heading">
                      <div>
                        <h3>{item.project_name || 'Untitled proof'}</h3>

                        <span className="service-status">
                          {(item.proof_type || 'project').replaceAll('_', ' ')}
                        </span>

                        {item.platform && (
                          <span className="service-status">
                            {item.platform}
                          </span>
                        )}

                        <span
                          className={
                            item.active
                              ? 'service-status active'
                              : 'service-status inactive'
                          }
                        >
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="service-card-actions">
                        {item.industry && (
                          <strong>{item.industry}</strong>
                        )}

                        <button
                          type="button"
                          className="service-edit-btn"
                          onClick={() => openPortfolioEditor(item)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {item.client_name && (
                      <p className="text-sm text-slate-400">
                        Client: {item.client_name}
                      </p>
                    )}

                    {item.summary && (
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {item.summary}
                      </p>
                    )}

                    {Array.isArray(item.services) && item.services.length > 0 && (
                      <div className="service-keywords">
                        {item.services.map((service, index) => (
                          <span key={`${item.id}-service-${index}`}>
                            {service}
                          </span>
                        ))}
                      </div>
                    )}

                    {Array.isArray(item.technologies) && item.technologies.length > 0 && (
                      <div className="service-keywords">
                        {item.technologies.map((technology, index) => (
                          <span key={`${item.id}-technology-${index}`}>
                            {technology}
                          </span>
                        ))}
                      </div>
                    )}

                    {Array.isArray(item.proof_points) && item.proof_points.length > 0 && (
                      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-400">
                        {item.proof_points.map((proofPoint, index) => (
                          <li key={`${item.id}-proof-${index}`}>
                            {proofPoint}
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.project_url && /^https?:\/\//i.test(item.project_url) && (
                      <a
                        href={item.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block text-sm font-medium text-violet-300 underline hover:text-violet-200"
                      >
                        Open Proof ↗
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
                  Search Strategy
                </p>

                <h2 className="mt-2 text-xl font-semibold text-white">
                  Opportunity Search
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Control what types of opportunities the engine searches for,
                  which markets to target, and how strict the buying-intent
                  filtering should be.
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Search Settings</h2>
                  {searchProfile && (
                    <p className="mt-1 text-sm text-slate-400">
                      {searchProfile.name || 'Active search profile'}
                    </p>
                  )}
                </div>

                {searchProfile && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    Active
                  </span>
                )}
              </div>

              {searchSettingsLoading ? (
                <p role="status" className="mt-6 text-sm text-slate-400">
                  Loading search settings...
                </p>
              ) : searchSettingsError && !searchProfile ? (
                <div role="alert" className="mt-6 border-l-2 border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <p>{searchSettingsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadSearchProfile(workspace?.id)}
                    className="mt-2 font-medium underline hover:text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : !searchProfile ? (
                <div className="mt-6 border-l-2 border-amber-500 bg-amber-500/10 px-4 py-3">
                  <p className="font-medium text-amber-200">No active search profile</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Complete search setup before editing dashboard search settings.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-7">
                  {/* Search profile summary */}
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Search Queries
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {normalizeSearchList(searchQueries).length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Target Countries
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {targetCountries.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Minimum Intent
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {minIntentLevel}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Freshness
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {maxAgeHours}h
                      </p>
                    </div>
                  </div>

                  <fieldset
                    disabled={searchSettingsSaving || searchRunning}
                    className="rounded-xl border border-slate-800 p-5"
                  >
                    <div className="mb-4">
                      <h3 className="font-medium text-white">
                        Target Markets
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Choose the countries where you want the engine to prioritize opportunities.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {SEARCH_COUNTRIES.map((country) => (
                        <label
                          key={country}
                          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                            targetCountries.includes(country)
                              ? 'border-violet-500/50 bg-violet-500/10 text-white'
                              : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={targetCountries.includes(country)}
                            onChange={(event) => {
                              setTargetCountries((current) =>
                                event.target.checked
                                  ? normalizeSearchList([...current, country])
                                  : current.filter((item) => item !== country)
                              )

                              setSearchSettingsError('')
                              setSearchSettingsMessage('')
                            }}
                            className="h-4 w-4 accent-violet-600"
                          />

                          {country}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <section className="rounded-xl border border-slate-800 p-5">
                    <div className="mb-5">
                      <h3 className="font-medium text-white">
                        Opportunity Quality
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Control how strict the engine should be when selecting opportunities.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-200">
                        Minimum Intent Level
                        <select
                          value={minIntentLevel}
                          onChange={(event) => {
                            setMinIntentLevel(Number(event.target.value))
                            setSearchSettingsError('')
                            setSearchSettingsMessage('')
                          }}
                          disabled={searchSettingsSaving || searchRunning}
                          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
                        >
                          <option value={1}>1 — Very broad</option>
                          <option value={2}>2 — Possible need</option>
                          <option value={3}>3 — Clear commercial intent</option>
                          <option value={4}>4 — Strong buying intent</option>
                          <option value={5}>5 — Immediate requirement</option>
                        </select>
                      </label>

                      <label className="block text-sm font-medium text-slate-200">
                        Opportunity Freshness
                        <select
                          value={maxAgeHours}
                          onChange={(event) => {
                            setMaxAgeHours(Number(event.target.value))
                            setSearchSettingsError('')
                            setSearchSettingsMessage('')
                          }}
                          disabled={searchSettingsSaving || searchRunning}
                          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
                        >
                          <option value={24}>Last 24 hours</option>
                          <option value={48}>Last 48 hours</option>
                          <option value={72}>Last 72 hours</option>
                          <option value={168}>Last 7 days</option>
                        </select>
                      </label>
                    </div>
                  </section>


                  <section className="overflow-hidden rounded-xl border border-slate-800">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-white">
                            Opportunity Sources
                          </h3>
                          <p className="mt-1 text-sm text-slate-400">
                            Choose where the engine acquires candidate opportunities before Quality v2 qualification.
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                          {enabledSources.length} enabled
                        </span>
                      </div>
                    </div>

                    {sourceAnalyticsError && (
                      <div className="border-b border-rose-500/20 bg-rose-500/5 px-5 py-3 text-sm text-rose-300">
                        {sourceAnalyticsError}
                      </div>
                    )}

                    <div className="divide-y divide-slate-800">
                      {SOURCE_CATALOG.map((sourceOption) => {
                        const isEnabled = enabledSources.includes(sourceOption.key)
                        const isFreelancer = sourceOption.key === 'freelancer'

                        return (
                          <div key={sourceOption.key} className="p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-3">
                                  <h4 className="font-medium text-white">
                                    {sourceOption.name}
                                  </h4>

                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                      sourceOption.available
                                        ? 'bg-emerald-500/10 text-emerald-300'
                                        : 'bg-amber-500/10 text-amber-300'
                                    }`}
                                  >
                                    {sourceOption.status}
                                  </span>

                                  {isEnabled && (
                                    <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                                      Enabled
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                                  {sourceOption.description}
                                </p>

                                {isFreelancer && !FREELANCER_PRODUCTION_ENABLED && (
                                  <p className="mt-2 text-xs leading-5 text-amber-300/90">
                                    Sandbox OAuth and the direct-source adapter are verified. Live activation is intentionally locked until a production Freelancer credential and production API environment are configured.
                                  </p>
                                )}

                                {(() => {
                                  const metrics = sourceAnalytics[sourceOption.key]

                                  if (sourceAnalyticsLoading && !metrics) {
                                    return (
                                      <p className="mt-3 text-xs text-slate-500">
                                        Loading 30-day source performance…
                                      </p>
                                    )
                                  }

                                  if (!metrics) {
                                    return (
                                      <p className="mt-3 text-xs text-slate-500">
                                        No source performance data recorded in the last 30 days.
                                      </p>
                                    )
                                  }

                                  const strategy =
                                    getAdaptiveSourceStrategy(metrics)

                                  return (
                                    <>
                                      <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                                          Adaptive routing
                                        </span>

                                        <span className="text-xs text-slate-400">
                                          {strategy.label}
                                        </span>

                                        {metrics.evaluated < strategy.minSample && (
                                          <span className="text-xs text-slate-500">
                                            {strategy.minSample - metrics.evaluated} more evaluations before throttling can begin
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                                      {[
                                        ['Evaluated', metrics.evaluated],
                                        [
                                          'Qualified',
                                          `${metrics.qualified} (${Math.round(metrics.qualificationRate)}%)`,
                                        ],
                                        ['Created', metrics.created],
                                        [
                                          'Duplicates',
                                          `${metrics.duplicates} (${Math.round(metrics.duplicateRate)}%)`,
                                        ],
                                        [
                                          'Avg score',
                                          metrics.averagePreliminaryScore == null
                                            ? '—'
                                            : Math.round(metrics.averagePreliminaryScore),
                                        ],
                                      ].map(([label, value]) => (
                                        <div
                                          key={label}
                                          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                                        >
                                          <div className="text-[11px] uppercase tracking-wide text-slate-500">
                                            {label}
                                          </div>
                                          <div className="mt-1 text-sm font-semibold text-slate-200">
                                            {value}
                                          </div>
                                        </div>
                                      ))}
                                      </div>

                                      <p className="mt-3 text-xs leading-5 text-slate-500">
                                        Adaptive Source Strategy V1 never disables a source automatically. Weak sources keep at least 25% floor traffic, while result-limit boosts require 25+ evaluated candidates.
                                      </p>
                                    </>
                                  )
                                })()}

                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                {isFreelancer && (
                                  <label className="block text-sm font-medium text-slate-300">
                                    Results per query
                                    <select
                                      value={freelancerResultLimit}
                                      onChange={(event) => {
                                        setFreelancerResultLimit(Number(event.target.value))
                                        setSearchSettingsError('')
                                        setSearchSettingsMessage('')
                                      }}
                                      disabled={
                                        !FREELANCER_PRODUCTION_ENABLED ||
                                        !isEnabled ||
                                        searchSettingsSaving ||
                                        searchRunning
                                      }
                                      className="mt-2 min-w-[150px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value={5}>5 results</option>
                                      <option value={10}>10 results</option>
                                      <option value={20}>20 results</option>
                                      <option value={50}>50 results</option>
                                    </select>
                                  </label>
                                )}

                                <label
                                  className={`flex min-h-11 items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
                                    sourceOption.available
                                      ? 'cursor-pointer border-slate-700 bg-slate-950 text-slate-200'
                                      : 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(event) => {
                                      const checked = event.target.checked

                                      setEnabledSources((current) =>
                                        normalizeSourceKeys(
                                          checked
                                            ? [...current, sourceOption.key]
                                            : current.filter(
                                                (item) => item !== sourceOption.key
                                              )
                                        )
                                      )

                                      setSearchSettingsError('')
                                      setSearchSettingsMessage('')
                                    }}
                                    disabled={
                                      !sourceOption.available ||
                                      searchSettingsSaving ||
                                      searchRunning
                                    }
                                    className="h-4 w-4 accent-violet-600"
                                  />

                                  {sourceOption.available
                                    ? isEnabled
                                      ? 'Enabled'
                                      : 'Enable'
                                    : 'Production locked'}
                                </label>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      <div className="grid gap-3 p-5 sm:grid-cols-2">
                        {[
                          ['Upwork', 'API access required'],
                          ['Reddit', 'Commercial API approval required'],
                        ].map(([name, status]) => (
                          <div
                            key={name}
                            className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-slate-300">
                                {name}
                              </span>
                              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-500">
                                Coming soon
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {status}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-slate-800">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="font-medium text-white">
                        Search Query Sources
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Choose which query sources the engine can use when looking for opportunities.
                      </p>
                    </div>

                    <div className="divide-y divide-slate-800">
                      <div className="p-5">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <h4 className="font-medium text-white">
                                AI-generated queries
                              </h4>

                              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                                {aiSuggestedQueries.length} queries
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  aiQueryGenerationEnabled
                                    ? 'bg-emerald-500/10 text-emerald-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {aiQueryGenerationEnabled
                                  ? 'Included'
                                  : 'Not included'}
                              </span>
                            </div>

                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                              AI creates buyer-intent search phrases from your services,
                              business profile and targeting preferences. Regenerate them
                              whenever your offer or ideal client changes.
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                              {aiQueriesGeneratedAt
                                ? `Last generated ${new Date(aiQueriesGeneratedAt).toLocaleString()}`
                                : 'No AI query set has been generated yet.'}
                            </p>

                            {searchSettingsMessage?.startsWith(
                              'AI queries regenerated'
                            ) && (
                              <p
                                role="status"
                                className="mt-3 text-sm text-emerald-300"
                              >
                                {searchSettingsMessage}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-200">
                              <input
                                type="checkbox"
                                checked={aiQueryGenerationEnabled}
                                onChange={(event) => {
                                  setAiQueryGenerationEnabled(event.target.checked)
                                  setSearchSettingsError('')
                                  setSearchSettingsMessage('')
                                }}
                                disabled={
                                  searchSettingsSaving ||
                                  searchRunning ||
                                  aiQueriesGenerating
                                }
                                className="h-4 w-4 accent-violet-600"
                              />

                              Include AI queries
                            </label>

                            <button
                              type="button"
                              onClick={() => void handleRegenerateAiQueries()}
                              disabled={
                                aiQueriesGenerating ||
                                !aiQueryGenerationEnabled ||
                                searchSettingsSaving ||
                                searchRunning ||
                                !searchProfile?.id
                              }
                              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {aiQueriesGenerating
                                ? 'Regenerating...'
                                : 'Regenerate'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setShowAdvancedQueries((current) => !current)
                          }
                          className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-slate-800/40"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <h4 className="font-medium text-white">
                                Custom search queries
                              </h4>

                              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                {normalizeSearchList(searchQueries).length} queries
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-400">
                              Your own exact search phrases. Use these when you want
                              direct control over what the engine searches for.
                            </p>
                          </div>

                          <span className="shrink-0 text-sm font-medium text-violet-400">
                            {showAdvancedQueries ? 'Close editor' : 'Edit queries'}
                          </span>
                        </button>

                        {showAdvancedQueries && (
                          <div className="border-t border-slate-800 p-5">
                            <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
                              <p className="text-sm text-slate-300">
                                Add one search phrase per line.
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Blank lines and duplicate queries are removed automatically
                                when you save.
                              </p>
                            </div>

                            <label
                              htmlFor="advanced-search-queries"
                              className="mt-5 block text-sm font-medium text-slate-200"
                            >
                              Custom Queries
                            </label>

                            <textarea
                              id="advanced-search-queries"
                              value={searchQueries.join('\n')}
                              onChange={(event) => {
                                setSearchQueries(event.target.value.split('\n'))
                                setSearchSettingsError('')
                                setSearchSettingsMessage('')
                              }}
                              disabled={searchSettingsSaving || searchRunning}
                              rows={14}
                              spellCheck="false"
                              className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500 disabled:opacity-50"
                              placeholder={`looking for logo designer
need PPC consultant
seeking contract lawyer
hiring video editor`}
                            />

                            <p className="mt-3 text-xs text-slate-500">
                              {normalizeSearchList(searchQueries).length} valid custom queries
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800 p-5">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-medium text-white">
                            Search Run Size
                          </h3>
                          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                            {queryBatchSize} per run
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          Choose how many search phrases the engine tries in one run.
                          It selects from your enabled AI queries and your custom query list.
                        </p>
                      </div>

                      <label className="block min-w-[220px] text-sm font-medium text-slate-200">
                        Queries used per run
                        <select
                          value={queryBatchSize}
                          onChange={(event) => {
                            setQueryBatchSize(Number(event.target.value))
                            setSearchSettingsError('')
                            setSearchSettingsMessage('')
                          }}
                          disabled={
                            searchSettingsSaving ||
                            searchRunning ||
                            aiQueriesGenerating
                          }
                          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
                        >
                          <option value={5}>5 queries</option>
                          <option value={10}>10 queries</option>
                          <option value={20}>20 queries</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <div className="flex flex-col gap-4 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {searchSettingsError && (
                        <p role="alert" className="text-sm text-red-300">
                          {searchSettingsError}
                        </p>
                      )}

                      {searchSettingsMessage &&
                        !searchSettingsMessage.startsWith(
                          'AI queries regenerated'
                        ) && (
                          <p role="status" className="text-sm text-emerald-300">
                            {searchSettingsMessage}
                          </p>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveSearchSettings()}
                      disabled={
                        searchSettingsSaving ||
                        searchRunning ||
                        normalizeSearchList(searchQueries).length === 0 ||
                        targetCountries.length === 0 ||
                        enabledSources.length === 0
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />

                      {searchSettingsSaving
                        ? 'Saving Changes...'
                        : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {portfolioDrawerOpen && (
              <div className="service-editor-overlay">
                <aside className="service-editor-panel">
                  <div className="service-editor-header">
                    <div>
                      <span className="settings-eyebrow">PROOF &amp; PROFILES</span>
                      <h2>
                        {editingPortfolio ? 'Edit Proof / Profile' : 'Add Proof / Profile'}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={closePortfolioEditor}
                      aria-label="Close portfolio editor"
                    >
                      ×
                    </button>
                  </div>

                  <form
                    className="service-editor-body"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void savePortfolio()
                    }}
                  >
                    <label>
                      Proof Type
                      <select
                        value={portfolioForm.proof_type}
                        onChange={(event) => {
                          setPortfolioForm((current) =>
                            changeProofType(current, event.target.value)
                          )
                          setPortfolioSaveError('')
                          setPortfolioSaveMessage('')
                        }}
                      >
                        {PROOF_TYPE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'platform'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'platform'
                        ).label}
                        <input
                          type="text"
                          value={portfolioForm.platform}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'platform'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              platform: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    <label>
                      {getProofFieldMeta(
                        portfolioForm.proof_type,
                        'project_name'
                      ).label}
                      <input
                        type="text"
                        required
                        value={portfolioForm.project_name}
                        placeholder={
                          getProofFieldMeta(
                            portfolioForm.proof_type,
                            'project_name'
                          ).placeholder
                        }
                        onChange={(event) =>
                          setPortfolioForm((current) => ({
                            ...current,
                            project_name: event.target.value,
                          }))
                        }
                      />
                    </label>

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'client_name'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'client_name'
                        ).label}
                        <input
                          type="text"
                          value={portfolioForm.client_name}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'client_name'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              client_name: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'industry'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'industry'
                        ).label}
                        <input
                          type="text"
                          value={portfolioForm.industry}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'industry'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              industry: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'services'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'services'
                        ).label}
                        <input
                          type="text"
                          value={portfolioForm.services}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'services'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              services: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'technologies'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'technologies'
                        ).label}
                        <input
                          type="text"
                          value={portfolioForm.technologies}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'technologies'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              technologies: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'project_url'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'project_url'
                        ).label}
                        <input
                          type="url"
                          value={portfolioForm.project_url}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'project_url'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              project_url: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'summary'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'summary'
                        ).label}
                        <textarea
                          value={portfolioForm.summary}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'summary'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              summary: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    {isProofFieldVisible(
                      portfolioForm.proof_type,
                      'proof_points'
                    ) && (
                      <label>
                        {getProofFieldMeta(
                          portfolioForm.proof_type,
                          'proof_points'
                        ).label}
                        <textarea
                          value={portfolioForm.proof_points}
                          placeholder={
                            getProofFieldMeta(
                              portfolioForm.proof_type,
                              'proof_points'
                            ).placeholder
                          }
                          onChange={(event) =>
                            setPortfolioForm((current) => ({
                              ...current,
                              proof_points: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    <label className="service-active-control">
                      <input
                        type="checkbox"
                        checked={portfolioForm.active}
                        onChange={(event) =>
                          setPortfolioForm((current) => ({
                            ...current,
                            active: event.target.checked,
                          }))
                        }
                      />

                      Use this as AI evidence
                    </label>

                    {portfolioSaveError && (
                      <div role="alert" className="settings-error-message">
                        {portfolioSaveError}
                      </div>
                    )}

                    {portfolioSaveMessage && (
                      <div role="status" className="settings-success-message">
                        {portfolioSaveMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={portfolioSaving}
                      className="primary-btn"
                    >
                      {portfolioSaving
                        ? 'Saving...'
                        : editingPortfolio
                          ? 'Save Proof'
                          : 'Add Proof'}
                    </button>
                  </form>
                </aside>
              </div>
            )}

            {businessProfileEditorOpen && (
              <div className="service-editor-overlay">
                <aside className="service-editor-panel">
                  <div className="service-editor-header">
                    <div>
                      <span className="settings-eyebrow">
                        BUSINESS PROFILE
                      </span>

                      <h2>Edit Business Profile</h2>
                    </div>

                    <button
                      type="button"
                      onClick={closeBusinessProfileEditor}
                      aria-label="Close business profile editor"
                    >
                      ×
                    </button>
                  </div>

                  <form
                    className="service-editor-body"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void saveBusinessProfile()
                    }}
                  >
                    <label>
                      Business Name
                      <input
                        type="text"
                        value={businessProfileForm.business_name}
                        onChange={(event) =>
                          setBusinessProfileForm((current) => ({
                            ...current,
                            business_name: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Business Type
                      <select
                        value={businessProfileForm.business_type}
                        onChange={(event) =>
                          setBusinessProfileForm((current) => ({
                            ...current,
                            business_type: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select business type</option>
                        <option value="freelancer">Freelancer</option>
                        <option value="small_agency">Small Agency</option>
                        <option value="agency">Agency</option>
                        <option value="company">Company</option>
                        <option value="consultant">Consultant</option>
                      </select>
                    </label>

                    <label>
                      Website
                      <input
                        type="url"
                        value={businessProfileForm.website_url}
                        onChange={(event) =>
                          setBusinessProfileForm((current) => ({
                            ...current,
                            website_url: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Preferred Language
                      <select
                        value={businessProfileForm.preferred_language}
                        onChange={(event) =>
                          setBusinessProfileForm((current) => ({
                            ...current,
                            preferred_language: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select language</option>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                      </select>
                    </label>

                    <label>
                      Base Country
                      <input
                        type="text"
                        value={businessProfileForm.provider_country}
                        placeholder="e.g. India"
                        onChange={(event) =>
                          setBusinessProfileForm((current) => ({
                            ...current,
                            provider_country: event.target.value,
                          }))
                        }
                      />
                      <span className="field-hint">
                        Used only when an opportunity explicitly requires the provider to be based in a specific country.
                      </span>
                    </label>

                    <label>
                      Working Languages
                      <input
                        type="text"
                        value={businessProfileForm.working_languages.join(', ')}
                        placeholder="e.g. English, Hindi"
                        onChange={(event) =>
                          setBusinessProfileForm((current) => ({
                            ...current,
                            working_languages: event.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          }))
                        }
                      />
                      <span className="field-hint">
                        Add only languages you can genuinely use for client communication and project delivery.
                      </span>
                    </label>

                    <div className="settings-ai-field">
                      <label>
                        Primary Goal
                        <textarea
                          value={businessProfileForm.primary_goal}
                          disabled={
                            businessProfileSaving ||
                            businessProfileAiField === 'main_goal'
                          }
                          onChange={(event) => {
                            setBusinessProfileForm((current) => ({
                              ...current,
                              primary_goal: event.target.value,
                            }))
                            setBusinessProfileAiMessage('')
                          }}
                        />
                      </label>

                      <div className="settings-ai-field-actions">
                        <span>
                          Add a short goal, then let AI make it more buyer-focused.
                        </span>
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={
                            businessProfileSaving ||
                            Boolean(businessProfileAiField)
                          }
                          onClick={() =>
                            void generateBusinessProfileCopy('main_goal')
                          }
                        >
                          {businessProfileAiField === 'main_goal'
                            ? 'Generating...'
                            : '✨ Generate with AI'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-ai-field-actions settings-ai-targeting-actions">
                      <span>
                        Let AI infer useful client types and rejection rules from your current goal and services.
                      </span>
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={
                          businessProfileSaving ||
                          Boolean(businessProfileAiField)
                        }
                        onClick={() =>
                          void generateBusinessProfileCopy(
                            'profile_filters'
                          )
                        }
                      >
                        {businessProfileAiField === 'profile_filters'
                          ? 'Generating targeting...'
                          : '✨ Auto-fill Targeting with AI'}
                      </button>
                    </div>

                    <div className="service-list-editor">
                      <div className="service-list-header">
                        <div>
                          <h3>Ideal Client Types</h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => addBusinessProfileArrayItem('ideal_client_types')}
                          className="secondary-btn"
                        >
                          + Add Client Type
                        </button>
                      </div>

                      <div className="service-list-items">
                        {businessProfileForm.ideal_client_types.map((clientType, index) => (
                          <div
                            className="service-list-row"
                            key={`client-type-${index}`}
                          >
                            <input
                              type="text"
                              value={clientType}
                              onChange={(event) =>
                                updateBusinessProfileArrayItem(
                                  'ideal_client_types',
                                  index,
                                  event.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              className="service-list-remove"
                              onClick={() =>
                                removeBusinessProfileArrayItem(
                                  'ideal_client_types',
                                  index
                                )
                              }
                              aria-label="Remove client type"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="settings-ai-field">
                      <label>
                        What Makes a Good Opportunity?
                        <textarea
                          value={businessProfileForm.good_opportunity_definition}
                          disabled={
                            businessProfileSaving ||
                            businessProfileAiField === 'good_opportunity'
                          }
                          onChange={(event) => {
                            setBusinessProfileForm((current) => ({
                              ...current,
                              good_opportunity_definition:
                                event.target.value,
                            }))
                            setBusinessProfileAiMessage('')
                          }}
                        />
                      </label>

                      <div className="settings-ai-field-actions">
                        <span>
                          AI can combine your goal, client types, services and rejection rules.
                        </span>
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={
                            businessProfileSaving ||
                            Boolean(businessProfileAiField)
                          }
                          onClick={() =>
                            void generateBusinessProfileCopy(
                              'good_opportunity'
                            )
                          }
                        >
                          {businessProfileAiField === 'good_opportunity'
                            ? 'Generating...'
                            : '✨ Generate with AI'}
                        </button>
                      </div>
                    </div>

                    <div className="service-list-editor">
                      <div className="service-list-header">
                        <div>
                          <h3>Rejection Rules</h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => addBusinessProfileArrayItem('rejection_rules')}
                          className="secondary-btn"
                        >
                          + Add Rejection Rule
                        </button>
                      </div>

                      <div className="service-list-items">
                        {businessProfileForm.rejection_rules.map((rule, index) => (
                          <div
                            className="service-list-row"
                            key={`rejection-rule-${index}`}
                          >
                            <input
                              type="text"
                              value={rule}
                              onChange={(event) =>
                                updateBusinessProfileArrayItem(
                                  'rejection_rules',
                                  index,
                                  event.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              className="service-list-remove"
                              onClick={() =>
                                removeBusinessProfileArrayItem(
                                  'rejection_rules',
                                  index
                                )
                              }
                              aria-label="Remove rejection rule"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {businessProfileAiMessage && (
                      <div role="status" className="settings-info-message">
                        {businessProfileAiMessage}
                      </div>
                    )}

                    {businessProfileError && (
                      <div role="alert" className="settings-error-message">
                        {businessProfileError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={businessProfileSaving}
                      className="primary-btn"
                    >
                      {businessProfileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </form>
                </aside>
              </div>
            )}

            {serviceDrawerOpen && serviceForm && (
              <div className="service-editor-overlay">
                <aside className="service-editor-panel">
                  <div className="service-editor-header">
                    <div>
                      <span className="settings-eyebrow">
                        SERVICE SETTINGS
                      </span>

                      <h2>
                        {editingService ? 'Edit Service' : 'Add Service'}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={closeServiceEditor}
                      aria-label="Close service editor"
                    >
                      ×
                    </button>
                  </div>

                  <div className="service-editor-body">
                    <label>
                      Service Name
                      <input
                        type="text"
                        value={serviceForm.name}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Description
                      <textarea
                        value={serviceForm.description}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="service-list-editor">
                      <div className="service-list-header">
                        <div>
                          <h3>Keywords</h3>
                          <p>
                            Terms the engine uses to understand and match this service.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addServiceListItem('keywords')}
                          className="secondary-btn"
                        >
                          + Add Keyword
                        </button>
                      </div>

                      <div className="service-list-items">
                        {serviceForm.keywords.map((keyword, index) => (
                          <div
                            className="service-list-row"
                            key={`keyword-${index}`}
                          >
                            <input
                              type="text"
                              value={keyword}
                              placeholder="e.g. brand strategist, tax consultant, video editor"
                              onChange={(event) =>
                                updateServiceListItem(
                                  'keywords',
                                  index,
                                  event.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              className="service-list-remove"
                              onClick={() =>
                                removeServiceListItem('keywords', index)
                              }
                              aria-label={`Remove ${keyword || 'keyword'}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="service-list-editor">
                      <div className="service-list-header">
                        <div>
                          <h3>Problems Solved</h3>
                          <p>
                            Client problems or requirements this service can solve.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addServiceListItem('problems_solved')}
                          className="secondary-btn"
                        >
                          + Add Problem
                        </button>
                      </div>

                      <div className="service-list-items">
                        {serviceForm.problems_solved.map((problem, index) => (
                          <div
                            className="service-list-row"
                            key={`problem-${index}`}
                          >
                            <input
                              type="text"
                              value={problem}
                              placeholder="e.g. rebranding, contract review, campaign management"
                              onChange={(event) =>
                                updateServiceListItem(
                                  'problems_solved',
                                  index,
                                  event.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              className="service-list-remove"
                              onClick={() =>
                                removeServiceListItem(
                                  'problems_solved',
                                  index
                                )
                              }
                              aria-label="Remove problem"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <label>
                      Minimum Project Value
                      <input
                        type="number"
                        min="0"
                        value={serviceForm.min_project_value}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            min_project_value: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Currency
                      <select
                        value={serviceForm.currency}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            currency: event.target.value,
                          }))
                        }
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="AUD">AUD</option>
                        <option value="AED">AED</option>
                      </select>
                    </label>

                    <label className="service-active-control">
                      <input
                        type="checkbox"
                        checked={serviceForm.active}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            active: event.target.checked,
                          }))
                        }
                      />

                      Active Service
                    </label>

                    {serviceSaveError && (
                      <div role="alert" className="settings-error-message">
                        {serviceSaveError}
                      </div>
                    )}

                    {serviceSaveMessage && (
                      <div role="status" className="settings-success-message">
                        {serviceSaveMessage}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={saveService}
                      disabled={serviceSaving}
                      className="primary-btn"
                    >
                      {serviceSaving
                        ? 'Saving...'
                        : editingService
                          ? 'Save Service'
                          : 'Add Service'}
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------
// FILTER BAR
// -----------------------------------------------------
function FilterBar({
  searchTerm,
  setSearchTerm,
  actionFilter,
  setActionFilter,
  scoreFilter,
  setScoreFilter,
  draftFilter,
  setDraftFilter,
  statusFilter,
  setStatusFilter,
  followUpFilter,
  setFollowUpFilter,
}) {
  return (
    <div className="p-5 border-b border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search opportunities..."
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
        />

        {/* Action */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500"
        >
          <option value="all">All Actions</option>
          <option value="high_priority_pitch">
            High Priority Pitch
          </option>
          <option value="pitch">Pitch</option>
          <option value="review">Review</option>
          <option value="skip">Skip</option>
        </select>

        {/* Score */}
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500"
        >
          <option value="all">All Scores</option>
          <option value="80+">80+ Excellent</option>
          <option value="70+">70+ Strong</option>
          <option value="60-69">60–69 Moderate</option>
          <option value="below60">Below 60</option>
        </select>

        {/* Draft */}
        <select
          value={draftFilter}
          onChange={(e) => setDraftFilter(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500"
        >
          <option value="all">All Drafts</option>
          <option value="ready">Draft Ready</option>
          <option value="missing">Draft Missing</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="pursue">Pursue</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="won">Won</option>
          <option value="ignored">Ignored</option>
        </select>

      </div>

      {followUpFilter !== 'all' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">Follow-up filter:</span>

          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-300">
            {followUpFilter === 'overdue'
              ? 'Overdue'
              : followUpFilter === 'today'
                ? 'Due Today'
                : 'Upcoming'}
          </span>

          <button
            type="button"
            onClick={() => setFollowUpFilter('all')}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------
// STAT CARD
// -----------------------------------------------------
function StatCard({ label, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  )
}

// -----------------------------------------------------
// STATUS BADGE
// -----------------------------------------------------

function StatusBadge({ status = 'new' }) {
  const normalizedStatus = status || 'new'

  const styles = {
    new: 'bg-slate-500/10 border-slate-500/30 text-slate-300',

    pursue:
      'bg-violet-500/10 border-violet-500/30 text-violet-300',

    contacted:
      'bg-blue-500/10 border-blue-500/30 text-blue-300',

    replied:
      'bg-amber-500/10 border-amber-500/30 text-amber-300',

    won:
      'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',

    ignored:
      'bg-red-500/10 border-red-500/30 text-red-300',
  }

  const labels = {
    new: 'New',
    pursue: 'Pursue',
    contacted: 'Contacted',
    replied: 'Replied',
    won: 'Won',
    ignored: 'Ignored',
  }

  return (
    <span
      className={`text-xs border px-2.5 py-1 rounded-full ${
        styles[normalizedStatus] || styles.new
      }`}
    >
      {labels[normalizedStatus] || normalizedStatus}
    </span>
  )
}


// -----------------------------------------------------
// OPPORTUNITY CARD
// -----------------------------------------------------
function OpportunityCard({
  opportunity,
  onViewDetails,
  onGeneratePitch,
  pitchGenerating,
  pitchDisabled,
  pitchError,
}) {
  const score = Number(opportunity.total_score || 0)
  const followUpState = getFollowUpState(opportunity.next_follow_up_at)

  const scoreStyle =
    score >= 75
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      : score >= 60
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        : 'bg-slate-800 text-slate-300 border-slate-700'

  return (
    <div className="p-6">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">

        <div className="flex-1 min-w-0">

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-3">

            <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-slate-300">
              {opportunity.source || 'Unknown source'}
            </span>

            {opportunity.country && (
              <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-slate-300">
                {opportunity.country}
              </span>
            )}

            {opportunity.recommended_action && (
              <span className="text-xs bg-violet-500/10 border border-violet-500/30 px-2.5 py-1 rounded-full text-violet-300">
                {opportunity.recommended_action}
              </span>
            )}

            {opportunity.outreach_message && (
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-emerald-300">
                Draft Ready
              </span>
            )}
            <StatusBadge status={opportunity.status || 'new'} />

            {followUpState === 'overdue' && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-300">
                Follow-up Overdue
              </span>
            )}

            {followUpState === 'today' && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                Follow-up Today
              </span>
            )}

            {followUpState === 'upcoming' && (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">
                Follow-up Scheduled
              </span>
            )}
            
          </div>

          {/* Title */}
          <h3 className="font-semibold text-lg text-white">
            {opportunity.title || 'Untitled opportunity'}
          </h3>

          {/* Requirement */}
          {opportunity.requirement && (
            <p className="text-slate-400 mt-2 leading-6">
              {opportunity.requirement}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-4 mt-5">

            <button
              onClick={onViewDetails}
              className="text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 transition font-medium"
            >
              View Details
            </button>

            {opportunity.source_url && (
              <a
                href={opportunity.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
              >
                Open Source ↗
              </a>
            )}

            {!opportunity.outreach_message &&
              (!opportunity.outreach_status ||
                opportunity.outreach_status === 'not_generated') && (
                <button
                  type="button"
                  onClick={onGeneratePitch}
                  disabled={pitchGenerating || pitchDisabled}
                  className="text-sm px-4 py-2 rounded-lg border border-violet-500/50 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pitchGenerating ? 'Generating Pitch...' : '✨ Generate Pitch'}
                </button>
              )}

          </div>

          {pitchError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {pitchError}
            </p>
          )}

        </div>

        {/* Score */}
        <div className="xl:w-32 shrink-0">

          <div
            className={`border rounded-xl px-4 py-3 text-center ${scoreStyle}`}
          >
            <p className="text-xs opacity-70">
              Score
            </p>

            <p className="text-2xl font-bold mt-1">
              {score}
            </p>

            <p className="text-xs opacity-70">
              / 100
            </p>
          </div>

        </div>
            
      </div>
    </div>
  )
}

function formatStatus(status) {
  const labels = {
    new: 'New',
    pursue: 'Pursued',
    contacted: 'Contacted',
    replied: 'Replied',
    won: 'Won',
    lost: 'Lost',
    ignored: 'Ignored',
  }

  return labels[status] || status || 'Unknown'
}

function formatActivityDate(date) {
  if (!date) return ''

  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getFollowUpState(date) {
  if (!date) return 'none'

  const followUp = new Date(date)
  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  )
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  if (followUp < now) {
    return 'overdue'
  }

  if (followUp >= todayStart && followUp < tomorrowStart) {
    return 'today'
  }

  return 'upcoming'
}

const CALENDAR_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseLocalDate(dateString) {
  if (!dateString) return null

  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    !year ||
    !month ||
    !day ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function formatLocalDateValue(date) {
  const pad = (value) => String(value).padStart(2, '0')

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-')
}

function ThemedDatePicker({ value, min, onChange }) {
  const calendarRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = parseLocalDate(value) || parseLocalDate(min) || new Date()
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  })

  const selectedDate = parseLocalDate(value)
  const minimumDate = parseLocalDate(min)
  const todayValue = formatLocalDateValue(new Date())

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const gridStart = new Date(year, month, 1 - firstDay.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      return date
    })
  }, [visibleMonth])

  const canGoToPreviousMonth =
    !minimumDate ||
    visibleMonth.getFullYear() > minimumDate.getFullYear() ||
    (visibleMonth.getFullYear() === minimumDate.getFullYear() &&
      visibleMonth.getMonth() > minimumDate.getMonth())

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!calendarRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const toggleCalendar = () => {
    if (!isOpen) {
      const initialDate = selectedDate || minimumDate || new Date()
      setVisibleMonth(
        new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
      )
    }

    setIsOpen((current) => !current)
  }

  const changeMonth = (offset) => {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1)
    )
  }

  const selectDate = (date) => {
    const dateValue = formatLocalDateValue(date)

    if (min && dateValue < min) return

    onChange(dateValue)
    setIsOpen(false)
  }

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Select a follow-up date'

  return (
    <div ref={calendarRef} className="relative">
      <button
        type="button"
        onClick={toggleCalendar}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`flex w-full items-center justify-between rounded-lg border bg-slate-950 px-4 py-3 text-left text-sm outline-none transition ${
          isOpen
            ? 'border-violet-500 ring-2 ring-violet-500/20'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <span className={selectedDate ? 'text-white' : 'text-slate-500'}>
          {displayValue}
        </span>

        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5 text-violet-400"
        >
          <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose follow-up date"
          className="absolute left-0 top-full z-40 mt-2 w-full min-w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/50"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-white">
              {visibleMonth.toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                disabled={!canGoToPreviousMonth}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span aria-hidden="true">←</span>
              </button>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {CALENDAR_WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="pb-2 text-center text-xs font-medium text-slate-500"
              >
                {weekday}
              </div>
            ))}

            {calendarDays.map((date) => {
              const dateValue = formatLocalDateValue(date)
              const isSelected = dateValue === value
              const isCurrentDay = dateValue === todayValue
              const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth()
              const isDisabled = Boolean(min && dateValue < min)

              return (
                <button
                  type="button"
                  key={dateValue}
                  onClick={() => selectDate(date)}
                  disabled={isDisabled}
                  aria-label={date.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-current={isCurrentDay ? 'date' : undefined}
                  aria-pressed={isSelected}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm transition ${
                    isSelected
                      ? 'bg-violet-600 font-semibold text-white shadow-lg shadow-violet-950/40'
                      : isDisabled
                        ? 'cursor-not-allowed text-slate-700'
                        : isOutsideMonth
                          ? 'text-slate-600 hover:bg-slate-800 hover:text-slate-300'
                          : isCurrentDay
                            ? 'border border-violet-500/60 text-violet-300 hover:bg-violet-500/10'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setIsOpen(false)
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => selectDate(new Date())}
              className="rounded-lg px-3 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-500/10 hover:text-violet-200"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OpportunityDrawer({
  opportunity,
  onClose,
  onUpdateStatus,
  onAddNote,
  onScheduleFollowUp,
  onCompleteFollowUp,
  opportunityActivity,
  activityLoading,
}) {
  const [copiedField, setCopiedField] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpHour, setFollowUpHour] = useState('')
  const [followUpMinute, setFollowUpMinute] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [followUpError, setFollowUpError] = useState('')

  const padNumber = (value) => String(value).padStart(2, '0')

  const getLocalDateString = (date = new Date()) => {
    return [
      date.getFullYear(),
      padNumber(date.getMonth() + 1),
      padNumber(date.getDate()),
    ].join('-')
  }

  const today = getLocalDateString()
  const currentTime = new Date()
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()

  const hourOptions = Array.from({ length: 24 }, (_, index) => index)
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const isToday = followUpDate === today

  const isHourDisabled = (hour) => {
    return isToday && hour < currentHour
  }

  const isMinuteDisabled = (minute) => {
    return (
      isToday &&
      Number(followUpHour) === currentHour &&
      minute <= currentMinute
    )
  }

  const copyToClipboard = async (text, fieldName) => {
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)

      setTimeout(() => {
        setCopiedField('')
      }, 1800)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  useEffect(() => {
    if (!opportunity) return

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [opportunity, onClose])

  const handleStatusChange = async (newStatus) => {
    if (!opportunity?.id || !onUpdateStatus) {
      return
    }

    setStatusLoading(true)
    setStatusError('')

    const success = await onUpdateStatus(
      opportunity.id,
      newStatus
    )

    if (!success) {
      setStatusError('Unable to update opportunity status.')
    }

    setStatusLoading(false)
  }

  const handleCompleteFollowUp = async () => {
    if (!opportunity?.id || !onCompleteFollowUp) {
      setStatusError('Unable to complete follow-up.')
      return
    }

    setStatusLoading(true)
    setStatusError('')

    const result = await onCompleteFollowUp(opportunity.id)

    setStatusLoading(false)

    if (!result?.success) {
      setStatusError(result?.error || 'Unable to complete follow-up.')
    }
  }

  const handleAddNote = async () => {
    const cleanNote = noteText.trim()

    if (!cleanNote) {
      setNoteError('Please enter a note first.')
      return
    }

    if (!opportunity?.id || !onAddNote) {
      setNoteError('Unable to add note.')
      return
    }

    setNoteLoading(true)
    setNoteError('')

    const result = await onAddNote(opportunity.id, cleanNote)

    if (!result?.success) {
      setNoteError(result?.error || 'Unable to add note.')
      setNoteLoading(false)
      return
    }

    setNoteText('')
    setNoteLoading(false)
  }

  const handleScheduleFollowUp = async () => {
    if (!followUpDate) {
      setFollowUpError('Please select a follow-up date.')
      return
    }

    if (followUpHour === '' || followUpMinute === '') {
      setFollowUpError('Please select a follow-up time.')
      return
    }

    if (!opportunity?.id || !onScheduleFollowUp) {
      setFollowUpError('Unable to schedule follow-up.')
      return
    }

    const localDateTime = `${followUpDate}T${padNumber(
      followUpHour
    )}:${padNumber(followUpMinute)}`

    const selectedDate = new Date(localDateTime)

    if (selectedDate <= new Date()) {
      setFollowUpError(
        'Follow-up must be scheduled for a future date and time.'
      )
      return
    }

    setFollowUpLoading(true)
    setFollowUpError('')

    const result = await onScheduleFollowUp(
      opportunity.id,
      localDateTime,
      followUpNote
    )

    if (!result?.success) {
      setFollowUpError(result?.error || 'Unable to schedule follow-up.')
      setFollowUpLoading(false)
      return
    }

    setFollowUpDate('')
    setFollowUpHour('')
    setFollowUpMinute('')
    setFollowUpNote('')
    setFollowUpLoading(false)
  }

  if (!opportunity) {
    return null
  }

  const score = Number(opportunity.total_score || 0)

  const formattedAction =
    opportunity.recommended_action
      ?.replaceAll('_', ' ')
      || 'Not assigned'

  const estimatedValue =
    Number(opportunity.estimated_value_min || 0) > 0 ||
    Number(opportunity.estimated_value_max || 0) > 0
      ? [
          Number(opportunity.estimated_value_min || 0) > 0
            ? new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: opportunity.estimated_currency || 'USD',
                maximumFractionDigits: 0,
              }).format(Number(opportunity.estimated_value_min))
            : null,
          Number(opportunity.estimated_value_max || 0) > 0
            ? new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: opportunity.estimated_currency || 'USD',
                maximumFractionDigits: 0,
              }).format(Number(opportunity.estimated_value_max))
            : null,
        ]
          .filter(Boolean)
          .join(' – ')
      : ''

  const sourceQualityScore = Number(
    opportunity.source_quality_score ?? 0
  )

  const commercialFit = String(
    opportunity.commercial_fit || 'unknown'
  ).trim().toLowerCase()

  const commercialFitLabel =
    commercialFit === 'meets_minimum'
      ? 'Meets service minimum'
      : commercialFit === 'below_minimum'
        ? 'Below service minimum'
        : commercialFit === 'far_below_minimum'
          ? 'Far below service minimum'
          : 'Budget fit unknown'

  const commercialFitClass =
    commercialFit === 'meets_minimum'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : commercialFit === 'below_minimum'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : commercialFit === 'far_below_minimum'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          : 'border-slate-700 bg-slate-800 text-slate-300'

  const eligibilityMatch = String(
    opportunity.eligibility_match || 'unknown'
  ).trim().toLowerCase()

  const eligibilityLabel =
    eligibilityMatch === 'match'
      ? 'Provider eligible'
      : eligibilityMatch === 'mismatch'
        ? 'Provider not eligible'
        : 'Eligibility not fully verified'

  const eligibilityClass =
    eligibilityMatch === 'match'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : eligibilityMatch === 'mismatch'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300'

  const scopeBudgetFit = String(
    opportunity.scope_budget_fit || 'unknown'
  ).trim().toLowerCase()

  const scopeBudgetFitLabel =
    scopeBudgetFit === 'meets_scope'
      ? 'Budget fits scope'
      : scopeBudgetFit === 'below_scope'
        ? 'Slightly below scope-adjusted minimum'
        : scopeBudgetFit === 'significantly_below_scope'
          ? 'Budget materially below scope'
          : scopeBudgetFit === 'far_below_scope'
            ? 'Budget far below scope'
            : 'Scope budget fit unknown'

  const scopeBudgetFitClass =
    scopeBudgetFit === 'meets_scope'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : scopeBudgetFit === 'below_scope'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : ['significantly_below_scope', 'far_below_scope'].includes(scopeBudgetFit)
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          : 'border-slate-700 bg-slate-800 text-slate-300'

  const hasSourceQualityAssessment =
    Boolean(opportunity.source_result_type) ||
    Boolean(opportunity.source_quality_reason)

  const sourceQualityLabel =
    !hasSourceQualityAssessment
      ? ''
      : sourceQualityScore >= 8
        ? 'Strong source evidence'
        : sourceQualityScore >= 6
          ? 'Good source evidence'
          : sourceQualityScore >= 4
            ? 'Limited source evidence'
            : 'Weak source evidence'

  const sourceQualityClass =
    sourceQualityScore >= 8
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : sourceQualityScore >= 6
        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
        : sourceQualityScore >= 4
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-300'

  const opportunityFacts = [
    opportunity.budget_text && {
      label: 'Posted Budget / Rate',
      value: opportunity.budget_text,
    },
    opportunity.commercial_fit && {
      label: 'Budget Fit',
      value: commercialFitLabel,
      note:
        commercialFit === 'below_minimum'
          ? 'Near service minimum'
          : commercialFit === 'meets_minimum'
            ? 'Commercially aligned'
            : commercialFit === 'far_below_minimum'
              ? 'Below commercial threshold'
              : 'No reliable comparison',
    },
    !opportunity.budget_text &&
      estimatedValue && {
        label: 'Estimated Value',
        value: estimatedValue,
        note: 'Estimate',
      },
    opportunity.project_language && {
      label: 'Project Language',
      value: opportunity.project_language.toUpperCase(),
    },
    opportunity.eligibility_match && {
      label: 'Provider Eligibility',
      value: eligibilityLabel,
      note:
        opportunity.eligibility_restriction_type &&
        opportunity.eligibility_restriction_type !== 'none'
          ? opportunity.eligibility_restriction_type.replaceAll('_', ' ')
          : 'No explicit restriction',
    },
    opportunity.required_language && {
      label: 'Required Language',
      value: opportunity.required_language,
    },
    opportunity.required_country && {
      label: 'Required Provider Country',
      value: opportunity.required_country,
    },
    opportunity.scope_complexity && {
      label: 'Scope Complexity',
      value: opportunity.scope_complexity.replaceAll('_', ' '),
      note:
        Number(opportunity.scope_multiplier || 0) > 0
          ? `${Number(opportunity.scope_multiplier)}× service minimum`
          : null,
    },
    opportunity.scope_budget_fit && {
      label: 'Scope Budget Fit',
      value: scopeBudgetFitLabel,
      note:
        Number(opportunity.scope_budget_fit_ratio || 0) > 0
          ? `${Math.round(Number(opportunity.scope_budget_fit_ratio) * 100)}% of adjusted minimum`
          : null,
    },
    opportunity.project_type && {
      label: 'Project Type',
      value: opportunity.project_type,
    },
    opportunity.duration_text && {
      label: 'Duration',
      value: opportunity.duration_text,
    },
    opportunity.workload_text && {
      label: 'Workload',
      value: opportunity.workload_text,
    },
    opportunity.experience_level && {
      label: 'Experience Level',
      value: opportunity.experience_level,
    },
    (opportunity.location_text || opportunity.remote_status) && {
      label: 'Location',
      value: [opportunity.location_text, opportunity.remote_status]
        .filter(Boolean)
        .join(' · '),
    },
    opportunity.contact_email && {
      label: 'Public Email',
      value: opportunity.contact_email,
      href: `mailto:${opportunity.contact_email}`,
    },
    opportunity.contact_phone && {
      label: 'Public Phone',
      value: opportunity.contact_phone,
      href: `tel:${opportunity.contact_phone.replace(/[^+\d]/g, '')}`,
    },
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50">

      {/* Dark background */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto">

        <div className="p-6 space-y-6">

          {/* Score */}
          <div className="grid grid-cols-2 gap-4">

            <DrawerInfo
              label="Final Score"
              value={`${score} / 100`}
            />

            <DrawerInfo
              label="Recommended Action"
              value={formattedAction}
            />

            <DrawerInfo
              label="Score Stage"
              value={opportunity.score_stage || '—'}
            />

            <DrawerInfo
              label="Research Status"
              value={opportunity.research_status || '—'}
            />

          </div>

          {/* Source */}
          <DrawerSection title="Source">

            <div className="flex flex-wrap gap-2">

              <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
                {opportunity.source || 'Unknown'}
              </span>

              {opportunity.country && (
                <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
                  {opportunity.country}
                </span>
              )}

            </div>

            {opportunity.eligibility_match && (
              <div className={`mt-4 rounded-xl border p-4 ${eligibilityClass}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {eligibilityLabel}
                  </span>

                  {opportunity.eligibility_restriction_type &&
                    opportunity.eligibility_restriction_type !== 'none' && (
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs capitalize">
                        {opportunity.eligibility_restriction_type.replaceAll('_', ' ')}
                      </span>
                    )}
                </div>

                {opportunity.eligibility_reason && (
                  <p className="mt-2 text-xs leading-5 opacity-80">
                    {opportunity.eligibility_reason}
                  </p>
                )}
              </div>
            )}

            {opportunity.scope_budget_fit && (
              <div className={`mt-4 rounded-xl border p-4 ${scopeBudgetFitClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {scopeBudgetFitLabel}
                  </span>

                  {Number(opportunity.scope_budget_fit_ratio || 0) > 0 && (
                    <span className="text-xs opacity-80">
                      {Math.round(Number(opportunity.scope_budget_fit_ratio) * 100)}% of scope-adjusted minimum
                    </span>
                  )}
                </div>

                {opportunity.scope_reason && (
                  <p className="mt-2 text-xs leading-5 opacity-80">
                    Scope: {opportunity.scope_reason}
                  </p>
                )}

                {opportunity.scope_budget_fit_reason && (
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    {opportunity.scope_budget_fit_reason}
                  </p>
                )}
              </div>
            )}

            {opportunity.commercial_fit && (
              <div className={`mt-4 rounded-xl border p-4 ${commercialFitClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {commercialFitLabel}
                  </span>

                  {Number(opportunity.budget_fit_ratio || 0) > 0 && (
                    <span className="text-xs opacity-80">
                      {Math.round(Number(opportunity.budget_fit_ratio) * 100)}% of service minimum
                    </span>
                  )}
                </div>

                {opportunity.commercial_value_reason && (
                  <p className="mt-2 text-xs leading-5 opacity-80">
                    {opportunity.commercial_value_reason}
                  </p>
                )}
              </div>
            )}

            {hasSourceQualityAssessment && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sourceQualityClass}`}
                  >
                    Source quality {sourceQualityScore}/10
                  </span>

                  <span className="text-sm font-medium text-slate-200">
                    {sourceQualityLabel}
                  </span>

                  {opportunity.buyer_likelihood && (
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs capitalize text-slate-300">
                      {opportunity.buyer_likelihood} buyer likelihood
                    </span>
                  )}

                  {opportunity.source_result_type && (
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs capitalize text-slate-300">
                      {opportunity.source_result_type.replaceAll('_', ' ')}
                    </span>
                  )}
                </div>

                {opportunity.source_quality_reason && (
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {opportunity.source_quality_reason}
                  </p>
                )}
              </div>
            )}

          </DrawerSection>

          {(opportunityFacts.length > 0 ||
            (Array.isArray(opportunity.skills) &&
              opportunity.skills.length > 0)) && (
            <DrawerSection title="Opportunity Facts">
              <div className="grid gap-3 sm:grid-cols-2">
                {opportunityFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {fact.label}
                      </p>

                      {fact.note && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                          {fact.note}
                        </span>
                      )}
                    </div>

                    {fact.href ? (
                      <a
                        href={fact.href}
                        className="mt-1 block break-all text-sm font-medium text-violet-300 hover:text-violet-200"
                      >
                        {fact.value}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-slate-200">
                        {fact.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {Array.isArray(opportunity.skills) &&
                opportunity.skills.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                      Skills / Expertise
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {opportunity.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </DrawerSection>
          )}

          {/* Requirement */}
          <DrawerSection title="Requirement">

            <p className="text-sm leading-6 text-slate-300">
              {opportunity.requirement || 'No requirement information available.'}
            </p>

          </DrawerSection>

          {/* Outreach */}
          <DrawerSection title="AI Outreach Draft">

            {opportunity.outreach_message ? (
              <div className="space-y-4">

                {opportunity.outreach_subject && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Subject
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            opportunity.outreach_subject,
                            'subject'
                          )
                        }
                        disabled={!opportunity.outreach_subject}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-violet-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {copiedField === 'subject' ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>

                    <p className="font-semibold text-white">
                      {opportunity.outreach_subject || 'No subject generated'}
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Message
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          opportunity.outreach_message,
                          'message'
                        )
                      }
                      disabled={!opportunity.outreach_message}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-violet-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {copiedField === 'message' ? 'Copied ✓' : 'Copy Message'}
                    </button>
                  </div>

                  <p className="whitespace-pre-wrap leading-7 text-slate-300">
                    {opportunity.outreach_message ||
                      'No outreach message generated'}
                  </p>
                </div>

                {opportunity.outreach_angle && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Outreach Angle
                    </p>

                    <p className="text-sm text-slate-300">
                      {opportunity.outreach_angle}
                    </p>
                  </div>
                )}

              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No outreach draft has been generated yet.
              </p>
            )}

          </DrawerSection>

          <DrawerSection title="Opportunity Status">
            <div className="space-y-4">

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                    Current Status
                  </p>

                  <StatusBadge status={opportunity.status || 'new'} />
                </div>
              </div>

              <OpportunityStatusActions
                status={opportunity.status || 'new'}
                loading={statusLoading}
                onChangeStatus={handleStatusChange}
              />

              {statusError && (
                <p className="text-sm text-red-300">
                  {statusError}
                </p>
              )}

            </div>
          </DrawerSection>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Follow Up
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Schedule the next action for this opportunity.
                </p>
              </div>

              {opportunity.next_follow_up_at && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                  Follow-up Scheduled
                </span>
              )}
            </div>

            {opportunity.next_follow_up_at && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Next Follow-up
                </p>

                <p className="mt-1 font-medium text-white">
                  {new Date(opportunity.next_follow_up_at).toLocaleString()}
                </p>

                {opportunity.follow_up_note && (
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {opportunity.follow_up_note}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCompleteFollowUp}
                  disabled={statusLoading}
                  className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {statusLoading ? 'Updating...' : 'Mark Follow-up Complete'}
                </button>
              </div>
            )}

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Follow-up Date
              </label>

              <ThemedDatePicker
                value={followUpDate}
                min={today}
                onChange={(date) => {
                  setFollowUpDate(date)
                  setFollowUpHour('')
                  setFollowUpMinute('')
                  setFollowUpError('')
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Hour
                </label>

                <select
                  value={followUpHour}
                  onChange={(e) => {
                    setFollowUpHour(e.target.value)
                    setFollowUpMinute('')
                    setFollowUpError('')
                  }}
                  disabled={!followUpDate}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select hour</option>

                  {hourOptions.map((hour) => {
                    const displayHour =
                      hour === 0
                        ? '12 AM'
                        : hour < 12
                          ? `${hour} AM`
                          : hour === 12
                            ? '12 PM'
                            : `${hour - 12} PM`

                    return (
                      <option
                        key={hour}
                        value={hour}
                        disabled={isHourDisabled(hour)}
                      >
                        {displayHour}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Minute
                </label>

                <select
                  value={followUpMinute}
                  onChange={(e) => {
                    setFollowUpMinute(e.target.value)
                    setFollowUpError('')
                  }}
                  disabled={followUpHour === ''}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select minute</option>

                  {minuteOptions.map((minute) => (
                    <option
                      key={minute}
                      value={minute}
                      disabled={isMinuteDisabled(minute)}
                    >
                      {padNumber(minute)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Follow-up Note
              </label>

              <textarea
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                rows={3}
                placeholder="Example: Follow up with relevant proof and ask whether they are ready to discuss next steps."
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500"
              />
            </div>

            {followUpError && (
              <p className="mt-3 text-sm text-red-300">{followUpError}</p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleScheduleFollowUp}
                disabled={
                  followUpLoading ||
                  !followUpDate ||
                  followUpHour === '' ||
                  followUpMinute === ''
                }
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {followUpLoading
                  ? 'Scheduling...'
                  : opportunity.next_follow_up_at
                    ? 'Update Follow-up'
                    : 'Schedule Follow-up'}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Activity Timeline
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Sales activity and status history for this opportunity.
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Add Note
              </label>

              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Example: Prospect asked for more information and suggested following up next week..."
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500"
              />

              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  {noteError && (
                    <p className="text-sm text-red-300">{noteError}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={noteLoading || !noteText.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {noteLoading ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>

            {activityLoading ? (
              <p className="text-sm text-slate-400">
                Loading activity...
              </p>
            ) : opportunityActivity.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-sm text-slate-400">
                  No activity recorded yet.
                </p>
              </div>
            ) : (
              <div className="relative">
                {opportunityActivity.map((activity, index) => {
                  const isLast =
                    index === opportunityActivity.length - 1

                  return (
                    <div
                      key={activity.id}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      {!isLast && (
                        <div className="absolute left-1.75 top-5 h-full w-px bg-slate-700" />
                      )}

                      <div className="relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-slate-950 bg-violet-500" />

                      <div className="min-w-0 flex-1">
                        {activity.activity_type === 'follow_up_completed' ? (
                          <>
                            <p className="font-semibold text-emerald-300">
                              Follow-up Completed
                            </p>

                            {activity.note && (
                              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm leading-6 text-slate-300">
                                {activity.note}
                              </p>
                            )}
                          </>
                        ) : activity.activity_type ===
                          'follow_up_scheduled' ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-amber-300">
                                Follow-up Scheduled
                              </span>
                            </div>

                            {activity.note && (
                              <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                                  {activity.note}
                                </p>
                              </div>
                            )}
                          </>
                        ) : activity.activity_type === 'note' ||
                          (activity.note &&
                            !activity.from_status &&
                            !activity.to_status) ? (
                          <>
                            <p className="font-semibold text-violet-300">
                              Note Added
                            </p>

                            {activity.note && (
                              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm leading-6 text-slate-300">
                                {activity.note}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-white">
                              <span>
                                {formatStatus(activity.from_status)}
                              </span>

                              <span className="mx-2 text-slate-500">→</span>

                              <span className="text-violet-300">
                                {formatStatus(activity.to_status)}
                              </span>
                            </p>

                            {activity.note && (
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {activity.note}
                              </p>
                            )}
                          </>
                        )}

                        <p className="mt-1 text-xs text-slate-500">
                          {formatActivityDate(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Source link */}
          {opportunity.source_url && (
            <a
              href={opportunity.source_url}
              target="_blank"
              rel="noreferrer"
              className="block text-center w-full bg-violet-600 hover:bg-violet-500 transition rounded-lg py-3 font-medium"
            >
              Open Original Opportunity  
            </a>
          )}

        </div>

      </div>

    </div>
  )
}

function OpportunityStatusActions({
  status,
  loading,
  onChangeStatus,
}) {
  const buttonBase =
    'px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'

  if (status === 'new') {
    return (
      <div className="flex flex-wrap gap-3">

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('pursue')}
          className={`${buttonBase} bg-violet-600 hover:bg-violet-500 text-white`}
        >
          {loading ? 'Updating...' : 'Pursue Opportunity'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('ignored')}
          className={`${buttonBase} border border-slate-700 hover:bg-slate-800 text-slate-300`}
        >
          Ignore
        </button>

      </div>
    )
  }

  if (status === 'pursue') {
    return (
      <div className="flex flex-wrap gap-3">

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('contacted')}
          className={`${buttonBase} bg-blue-600 hover:bg-blue-500 text-white`}
        >
          {loading ? 'Updating...' : 'Mark as Contacted'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('ignored')}
          className={`${buttonBase} border border-slate-700 hover:bg-slate-800 text-slate-300`}
        >
          Ignore
        </button>

      </div>
    )
  }

  if (status === 'contacted') {
    return (
      <div className="flex flex-wrap gap-3">

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('replied')}
          className={`${buttonBase} bg-amber-600 hover:bg-amber-500 text-white`}
        >
          {loading ? 'Updating...' : 'Mark as Replied'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('ignored')}
          className={`${buttonBase} border border-slate-700 hover:bg-slate-800 text-slate-300`}
        >
          Ignore
        </button>

      </div>
    )
  }

  if (status === 'replied') {
    return (
      <div className="flex flex-wrap gap-3">

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('won')}
          className={`${buttonBase} bg-emerald-600 hover:bg-emerald-500 text-white`}
        >
          {loading ? 'Updating...' : 'Mark as Won'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('ignored')}
          className={`${buttonBase} border border-slate-700 hover:bg-slate-800 text-slate-300`}
        >
          Ignore
        </button>

      </div>
    )
  }

  if (status === 'won') {
    return (
      <div className="flex items-center justify-between gap-4">

        <p className="text-sm text-emerald-300">
          ✓ Opportunity successfully converted.
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('new')}
          className={`${buttonBase} border border-slate-700 hover:bg-slate-800 text-slate-400`}
        >
          Reset
        </button>

      </div>
    )
  }

  if (status === 'ignored') {
    return (
      <div className="flex items-center justify-between gap-4">

        <p className="text-sm text-slate-400">
          This opportunity has been ignored.
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={() => onChangeStatus('new')}
          className={`${buttonBase} border border-slate-700 hover:bg-slate-800 text-slate-300`}
        >
          Restore Opportunity
        </button>

      </div>
    )
  }

  return null
}

function DrawerSection({ title, children }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5">

      <h3 className="text-sm font-medium text-slate-200 mb-4">
        {title}
      </h3>

      {children}

    </div>
  )
}

function DrawerInfo({ label, value }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">

      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="text-sm font-medium text-slate-200 mt-2 capitalize">
        {value}
      </p>

    </div>
  )
}

export default App
