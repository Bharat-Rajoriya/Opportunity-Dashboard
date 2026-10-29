import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  generateOnboardingCopy,
  triggerAiQueryGeneration,
} from '../services/opportunityEngine'

const idealListFields = ['target_countries', 'ideal_client_types', 'rejection_rules']
const emptyPortfolioForm = {
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
}

const parseCommaList = (value = '') =>
  normalizeIdealItems(typeof value === 'string' ? value.split(',') : [])

const parseLines = (value = '') =>
  (typeof value === 'string' ? value.split('\n') : [])
    .map((item) => item.trim())
    .filter(Boolean)

function normalizeIdealItems(items) {
  if (!Array.isArray(items)) return []

  const seen = new Set()
  return items
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function createIdealForm(profile) {
  return {
    target_countries: normalizeIdealItems(profile?.target_countries),
    ideal_client_types: normalizeIdealItems(profile?.ideal_client_types),
    rejection_rules: normalizeIdealItems(profile?.rejection_rules),
    good_opportunity_definition:
      typeof profile?.good_opportunity_definition === 'string'
        ? profile.good_opportunity_definition
        : '',
  }
}

function Onboarding({ user, workspace, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState('English')
  const [idealForm, setIdealForm] = useState(() => createIdealForm())
  const [countryInput, setCountryInput] = useState('')
  const [clientTypeInput, setClientTypeInput] = useState('')
  const [rejectionRuleInput, setRejectionRuleInput] = useState('')
  const [idealSaving, setIdealSaving] = useState(false)
  const [idealMessage, setIdealMessage] = useState('')
  const [profileLoadError, setProfileLoadError] = useState('')
  const profileLoadRequest = useRef(0)
  const idealSavePending = useRef(false)
  const profileSavePending = useRef(false)
  const [searchForm, setSearchForm] = useState({
    min_intent_level: 3,
    max_age_hours: 72,
    active: true,
  })
  const [searchSaving, setSearchSaving] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [searchLoading, setSearchLoading] = useState(true)
  const [searchLoadError, setSearchLoadError] = useState('')
  const searchLoadRequest = useRef(0)
  const searchProfileId = useRef(null)
  const searchSavePending = useRef(false)
  const [portfolioItems, setPortfolioItems] = useState([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioMessage, setPortfolioMessage] = useState('')
  const [portfolioLoadError, setPortfolioLoadError] = useState('')
  const [portfolioForm, setPortfolioForm] = useState(() => ({ ...emptyPortfolioForm }))
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  const [editingPortfolioId, setEditingPortfolioId] = useState(null)
  const [portfolioSaving, setPortfolioSaving] = useState(false)
  const [portfolioTogglingId, setPortfolioTogglingId] = useState(null)
  const portfolioLoadRequest = useRef(0)
  const portfolioMutationPendingRef = useRef(false)
  const [completingSetup, setCompletingSetup] = useState(false)
  const completionPendingRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [aiAssistField, setAiAssistField] = useState('')
  const [aiAssistMessage, setAiAssistMessage] = useState('')
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesMessage, setServicesMessage] = useState('')
  const [servicesMessageType, setServicesMessageType] = useState('error')
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceTogglingId, setServiceTogglingId] = useState(null)
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    keywords: [],
    problems_solved: [],
    min_project_value: '',
    currency: 'INR',
    active: true,
  })
  const [serviceKeywordText, setServiceKeywordText] = useState('')
  const [serviceProblemText, setServiceProblemText] = useState('')
  const servicesLoadRequest = useRef(0)
  const workspaceId = workspace?.id
  const serviceMutationPending = serviceSaving || serviceTogglingId !== null
  const portfolioMutationPending = portfolioSaving || portfolioTogglingId !== null || completingSetup

  const handleAiAssist = async (fieldType) => {
    if (!workspace?.id || aiAssistField) return

    let roughText
    let context

    if (fieldType === 'main_goal') {
      roughText = primaryGoal
      context = {
        business_name: businessName.trim(),
        business_type: businessType,
        website: websiteUrl.trim(),
        preferred_language: preferredLanguage,
        services: services
          .filter((service) => service.active !== false)
          .map((service) => ({
            name: service.name,
            description: service.description,
            keywords: service.keywords,
            problems_solved: service.problems_solved,
          })),
      }
    } else if (fieldType === 'service_description') {
      roughText =
        serviceForm.description.trim() ||
        serviceForm.name.trim() ||
        serviceKeywordText.trim() ||
        serviceProblemText.trim()

      context = {
        business_name: businessName.trim(),
        business_type: businessType,
        primary_goal: primaryGoal.trim(),
        service_name: serviceForm.name.trim(),
        keywords: serviceKeywordText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        problems_solved: serviceProblemText
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      }
    } else if (
      fieldType === 'good_opportunity' ||
      fieldType === 'profile_filters'
    ) {
      roughText =
        fieldType === 'profile_filters'
          ? primaryGoal.trim() ||
            idealForm.good_opportunity_definition.trim()
          : idealForm.good_opportunity_definition

      context = {
        business_name: businessName.trim(),
        business_type: businessType,
        preferred_language: preferredLanguage,
        primary_goal: primaryGoal.trim(),
        target_countries: idealForm.target_countries,
        ideal_client_types: idealForm.ideal_client_types,
        rejection_rules: idealForm.rejection_rules,
        services: services
          .filter((service) => service.active !== false)
          .map((service) => ({
            name: service.name,
            description: service.description,
            keywords: service.keywords,
            problems_solved: service.problems_solved,
          })),
      }
    } else {
      return
    }

    const hasContext = Object.values(context).some((value) =>
      Array.isArray(value)
        ? value.length > 0
        : Boolean(value)
    )

    if (!roughText.trim() && !hasContext) {
      setAiAssistMessage(
        'Add a few details first so AI has something accurate to work with.'
      )
      return
    }

    setAiAssistField(fieldType)
    setAiAssistMessage('')

    try {
      const result = await generateOnboardingCopy({
        workspaceId: workspace.id,
        fieldType,
        roughText,
        context,
      })

      if (fieldType === 'main_goal') {
        setPrimaryGoal(result.generated_text)
      } else if (fieldType === 'service_description') {
        setServiceForm((previous) => ({
          ...previous,
          description: result.generated_text,
        }))
      } else if (fieldType === 'good_opportunity') {
        setIdealForm((previous) => ({
          ...previous,
          good_opportunity_definition: result.generated_text,
        }))
        setIdealMessage('')
      } else if (fieldType === 'profile_filters') {
        setIdealForm((previous) => ({
          ...previous,
          ideal_client_types: normalizeIdealItems([
            ...previous.ideal_client_types,
            ...(result.ideal_client_types || []),
          ]),
          rejection_rules: normalizeIdealItems([
            ...previous.rejection_rules,
            ...(result.rejection_rules || []),
          ]),
        }))
        setIdealMessage('')
      }

      setAiAssistMessage(
        fieldType === 'profile_filters'
          ? 'AI targeting filters added. Review them before continuing.'
          : 'AI draft generated. Review and edit it before continuing.'
      )
    } catch (error) {
      console.error('Unable to generate onboarding copy:', error)
      setAiAssistMessage(
        error?.message ||
          'Unable to generate AI-assisted copy right now.'
      )
    } finally {
      setAiAssistField('')
    }
  }

  const openNewServiceForm = () => {
    if (serviceMutationPending) return

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
    setServiceKeywordText('')
    setServiceProblemText('')
    setServicesMessage('')
    setServicesMessageType('error')
    setShowServiceForm(true)
  }

  const openEditService = (service) => {
    if (serviceMutationPending || showServiceForm) return

    setEditingService(service)
    setServiceForm({
      name: service.name || '',
      description: service.description || '',
      keywords: service.keywords || [],
      problems_solved: service.problems_solved || [],
      min_project_value: service.min_project_value ?? '',
      currency: service.currency || 'INR',
      active: service.active ?? true,
    })
    setServiceKeywordText(
      Array.isArray(service.keywords) ? service.keywords.join(', ') : ''
    )
    setServiceProblemText(
      Array.isArray(service.problems_solved) ? service.problems_solved.join('\n') : ''
    )
    setServicesMessage('')
    setServicesMessageType('error')
    setShowServiceForm(true)

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const loadServices = useCallback(async () => {
    const requestId = ++servicesLoadRequest.current
    setServices([])
    setServicesMessage('')
    setServicesMessageType('error')

    if (!workspaceId) {
      setServicesLoading(false)
      return false
    }

    setServicesLoading(true)

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

      if (requestId !== servicesLoadRequest.current) return false
      if (error) throw error

      setServices(data || [])
      return true
    } catch (error) {
      if (requestId === servicesLoadRequest.current) {
        console.error('Unable to load services:', error)
        setServicesMessage('Unable to load your services.')
      }
      return false
    } finally {
      if (requestId === servicesLoadRequest.current) {
        setServicesLoading(false)
      }
    }
  }, [workspaceId])

  useEffect(() => {
    loadServices()

    return () => {
      servicesLoadRequest.current += 1
    }
  }, [loadServices])

  const loadPortfolioItems = useCallback(async () => {
    const requestId = ++portfolioLoadRequest.current
    setPortfolioItems([])
    setPortfolioMessage('')
    setPortfolioLoadError('')

    if (!workspaceId) {
      setPortfolioLoading(false)
      return false
    }

    setPortfolioLoading(true)

    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (requestId !== portfolioLoadRequest.current) return false
      if (error) throw error

      setPortfolioItems(data || [])
      return true
    } catch (error) {
      if (requestId === portfolioLoadRequest.current) {
        console.error('Unable to load portfolio items:', error)
        setPortfolioLoadError(error?.message || 'Unable to load proof & profiles.')
        setPortfolioMessage(error?.message || 'Unable to load proof & profiles.')
      }
      return false
    } finally {
      if (requestId === portfolioLoadRequest.current) setPortfolioLoading(false)
    }
  }, [workspaceId])

  const loadSearchProfile = useCallback(async () => {
    const requestId = ++searchLoadRequest.current
    searchProfileId.current = null
    setSearchLoading(true)
    setSearchLoadError('')
    setSearchSaving(false)
    setSearchMessage('')
    setSearchForm({ min_intent_level: 3, max_age_hours: 72, active: true })

    try {
      if (!workspaceId) return

      const { data, error } = await supabase
        .from('search_profiles')
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle()

      if (requestId !== searchLoadRequest.current) return
      if (error) throw error
      if (!data) return

      const minIntentLevel = Number(data.min_intent_level)
      const maxAgeHours = Number(data.max_age_hours)

      searchProfileId.current = data.id
      setSearchForm({
        min_intent_level:
          Number.isFinite(minIntentLevel) && minIntentLevel > 0 ? minIntentLevel : 3,
        max_age_hours:
          Number.isFinite(maxAgeHours) && maxAgeHours > 0 ? maxAgeHours : 72,
        active: typeof data.active === 'boolean' ? data.active : true,
      })
    } catch (error) {
      if (requestId === searchLoadRequest.current) {
        console.error('Unable to load search profile:', error)
        setSearchLoadError(error?.message || 'Unable to load search profile.')
        setSearchMessage(error?.message || 'Unable to load search profile.')
      }
    } finally {
      if (requestId === searchLoadRequest.current) setSearchLoading(false)
    }
  }, [workspaceId])

  const loadBusinessProfile = useCallback(async () => {
    const requestId = ++profileLoadRequest.current
    setLoading(true)
    setProfileLoadError('')
    setMessage('')
    setIdealMessage('')
    setIdealSaving(false)
    setSaving(false)

    try {
      if (!workspaceId) throw new Error('Workspace not found.')

      const { data, error } = await supabase
        .from('business_profiles')
        .select(`
          business_name,
          business_type,
          website_url,
          primary_goal,
          preferred_language,
          target_countries,
          ideal_client_types,
          rejection_rules,
          good_opportunity_definition
        `)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (requestId !== profileLoadRequest.current) return
      if (error) throw error

      setBusinessName(data?.business_name || '')
      setBusinessType(data?.business_type || '')
      setWebsiteUrl(data?.website_url || '')
      setPrimaryGoal(data?.primary_goal || '')
      setPreferredLanguage(data?.preferred_language || 'English')
      setIdealForm(createIdealForm(data))
      setCountryInput('')
      setClientTypeInput('')
      setRejectionRuleInput('')
    } catch (error) {
      if (requestId === profileLoadRequest.current) {
        console.error('Business profile load error:', error)
        setProfileLoadError(error?.message || 'Unable to load your business profile.')
      }
    } finally {
      if (requestId === profileLoadRequest.current) {
        setLoading(false)
      }
    }
  }, [workspaceId])

  useEffect(() => {
    setCurrentStep(1)
    setShowPortfolioForm(false)
    setEditingPortfolioId(null)
    setPortfolioForm({ ...emptyPortfolioForm })
    setPortfolioSaving(false)
    setPortfolioTogglingId(null)
    setCompletingSetup(false)
    loadBusinessProfile()
    loadSearchProfile()
    loadPortfolioItems()

    return () => {
      profileLoadRequest.current += 1
      searchLoadRequest.current += 1
      portfolioLoadRequest.current += 1
    }
  }, [loadBusinessProfile, loadSearchProfile, loadPortfolioItems])

  const addUniqueItem = (field, value) => {
    if (idealSavePending.current || !idealListFields.includes(field)) return

    setIdealForm((previous) => ({
      ...previous,
      [field]: normalizeIdealItems([...previous[field], value]),
    }))
    setIdealMessage('')
  }

  const removeItem = (field, value) => {
    if (idealSavePending.current || !idealListFields.includes(field)) return

    setIdealForm((previous) => ({
      ...previous,
      [field]: previous[field].filter((item) => item !== value),
    }))
    setIdealMessage('')
  }

  const openNewPortfolioForm = () => {
    if (completionPendingRef.current || portfolioMutationPendingRef.current || portfolioLoading || portfolioLoadError) return

    setEditingPortfolioId(null)
    setPortfolioForm({ ...emptyPortfolioForm })
    setPortfolioMessage('')
    setShowPortfolioForm(true)
  }

  const editPortfolioItem = (item) => {
    if (completionPendingRef.current || portfolioMutationPendingRef.current || portfolioLoading || portfolioLoadError || showPortfolioForm) return

    setEditingPortfolioId(item.id)
    setPortfolioForm({
      proof_type: item.proof_type || 'project',
      platform: item.platform || '',
      project_name: item.project_name || '',
      client_name: item.client_name || '',
      industry: item.industry || '',
      services: normalizeIdealItems(item.services).join(', '),
      technologies: normalizeIdealItems(item.technologies).join(', '),
      project_url: item.project_url || '',
      summary: item.summary || '',
      proof_points: Array.isArray(item.proof_points)
        ? item.proof_points.filter((point) => typeof point === 'string').join('\n')
        : '',
    })
    setPortfolioMessage('')
    setShowPortfolioForm(true)
  }

  const cancelPortfolioForm = () => {
    if (completionPendingRef.current || portfolioMutationPendingRef.current) return

    setShowPortfolioForm(false)
    setEditingPortfolioId(null)
    setPortfolioForm({ ...emptyPortfolioForm })
    setPortfolioMessage('')
  }

  const savePortfolioItem = async () => {
    if (completionPendingRef.current || portfolioMutationPendingRef.current || portfolioLoading || portfolioLoadError || loading || profileLoadError) return

    setPortfolioMessage('')
    if (!workspaceId) {
      setPortfolioMessage('Workspace not found.')
      return
    }
    if (!portfolioForm.project_name.trim()) {
      setPortfolioMessage('Proof title is required.')
      return
    }

    const projectUrl = portfolioForm.project_url.trim()
    if (projectUrl) {
      try {
        const url = new URL(projectUrl)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
      } catch {
        setPortfolioMessage('Please enter a valid proof/profile URL starting with http:// or https://.')
        return
      }
    }

    const requestId = profileLoadRequest.current
    portfolioMutationPendingRef.current = true
    setPortfolioSaving(true)

    try {
      const payload = {
        proof_type: portfolioForm.proof_type || 'other',
        platform: portfolioForm.platform.trim() || null,
        project_name: portfolioForm.project_name.trim(),
        client_name: portfolioForm.client_name.trim() || null,
        industry: portfolioForm.industry.trim() || null,
        services: parseCommaList(portfolioForm.services),
        technologies: parseCommaList(portfolioForm.technologies),
        project_url: projectUrl || null,
        summary: portfolioForm.summary.trim() || null,
        proof_points: parseLines(portfolioForm.proof_points),
        updated_at: new Date().toISOString(),
      }

      const result = editingPortfolioId
        ? await supabase
            .from('portfolio_items')
            .update(payload)
            .eq('id', editingPortfolioId)
            .eq('workspace_id', workspaceId)
            .select('id')
            .single()
        : await supabase
            .from('portfolio_items')
            .insert({ ...payload, workspace_id: workspaceId, active: true })
            .select('id')
            .single()

      if (requestId !== profileLoadRequest.current) return
      if (result.error) throw result.error
      if (!result.data?.id) throw new Error('Proof or profile could not be saved.')

      const refreshed = await loadPortfolioItems()
      if (requestId !== profileLoadRequest.current) return

      setShowPortfolioForm(false)
      setEditingPortfolioId(null)
      setPortfolioForm({ ...emptyPortfolioForm })
      if (!refreshed) {
        setPortfolioMessage('Proof saved, but the list could not be refreshed. Please retry loading.')
      }
    } catch (error) {
      if (requestId === profileLoadRequest.current) {
        console.error('Unable to save portfolio item:', error)
        setPortfolioMessage(error?.message || 'Unable to save proof or profile.')
      }
    } finally {
      portfolioMutationPendingRef.current = false
      if (requestId === profileLoadRequest.current) setPortfolioSaving(false)
    }
  }

  const togglePortfolioActive = async (item) => {
    if (!workspaceId || completionPendingRef.current || portfolioMutationPendingRef.current || portfolioLoading || portfolioLoadError || showPortfolioForm) return

    const requestId = profileLoadRequest.current
    portfolioMutationPendingRef.current = true
    setPortfolioTogglingId(item.id)
    setPortfolioMessage('')

    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .update({ active: !item.active, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('workspace_id', workspaceId)
        .select('id')
        .single()

      if (requestId !== profileLoadRequest.current) return
      if (error) throw error
      if (!data?.id) throw new Error('Proof or profile could not be found.')

      const refreshed = await loadPortfolioItems()
      if (requestId !== profileLoadRequest.current) return
      if (!refreshed) {
        setPortfolioMessage('Proof status updated, but the list could not be refreshed. Please retry loading.')
      }
    } catch (error) {
      if (requestId === profileLoadRequest.current) {
        console.error('Unable to update portfolio status:', error)
        setPortfolioMessage(error?.message || 'Unable to update proof status.')
      }
    } finally {
      portfolioMutationPendingRef.current = false
      if (requestId === profileLoadRequest.current) setPortfolioTogglingId(null)
    }
  }

  const buildSearchQueries = () => {
    const queries = []

    services.filter((service) => service.active).forEach((service) => {
      const serviceName = typeof service.name === 'string' ? service.name.trim() : ''
      if (serviceName) {
        queries.push(`looking for ${serviceName}`, `need ${serviceName}`)
        queries.push(`seeking ${serviceName}`, `hiring ${serviceName}`)
      }

      const keywords = Array.isArray(service.keywords) ? service.keywords.slice(0, 5) : []
      keywords.forEach((keyword) => {
        const cleanedKeyword = typeof keyword === 'string' ? keyword.trim() : ''
        if (cleanedKeyword) {
          queries.push(`looking for ${cleanedKeyword}`, `need ${cleanedKeyword}`)
        }
      })
    })

    return normalizeIdealItems(queries)
  }

  const saveSearchPreferences = async () => {
    if (
      searchSavePending.current || searchLoading || searchLoadError ||
      servicesLoading || serviceMutationPending || loading || profileLoadError
    ) return

    setSearchMessage('')
    if (!workspaceId) {
      setSearchMessage('Workspace not found.')
      return
    }

    const searchQueries = buildSearchQueries()
    if (!searchQueries.length) {
      setSearchMessage('Please activate at least one service before continuing.')
      return
    }

    const targetCountries = normalizeIdealItems(idealForm.target_countries)
    if (!targetCountries.length) {
      setSearchMessage('Please select target countries in Step 3 before continuing.')
      return
    }

    const minIntentLevel = Number(searchForm.min_intent_level)
    const maxAgeHours = Number(searchForm.max_age_hours)
    if (!Number.isInteger(minIntentLevel) || minIntentLevel < 1 || minIntentLevel > 5) {
      setSearchMessage('Minimum buying intent must be a whole number between 1 and 5.')
      return
    }
    if (!Number.isInteger(maxAgeHours) || maxAgeHours <= 0) {
      setSearchMessage('Opportunity freshness must be a positive whole number of hours.')
      return
    }

    const requestId = searchLoadRequest.current
    const loadedProfileId = searchProfileId.current
    searchSavePending.current = true
    setSearchSaving(true)

    try {
      let lookup = supabase.from('search_profiles').select('id').eq('workspace_id', workspaceId)
      if (loadedProfileId) lookup = lookup.eq('id', loadedProfileId)

      const { data: existingProfile, error: findError } = await lookup.limit(1).maybeSingle()
      if (requestId !== searchLoadRequest.current) return
      if (findError) throw findError
      if (loadedProfileId && !existingProfile?.id) {
        throw new Error('Your search profile could not be found. Please reload it before saving.')
      }

      const payload = {
        workspace_id: workspaceId,
        name: 'Primary Opportunity Search',
        search_queries: searchQueries,
        target_countries: targetCountries,
        min_intent_level: minIntentLevel,
        max_age_hours: maxAgeHours,
        active: Boolean(searchForm.active),
        updated_at: new Date().toISOString(),
      }

      const result = existingProfile?.id
        ? await supabase
            .from('search_profiles')
            .update(payload)
            .eq('id', existingProfile.id)
            .eq('workspace_id', workspaceId)
            .select('id')
            .single()
        : await supabase
            .from('search_profiles')
            .insert({ ...payload, source: 'pending' })
            .select('id')
            .single()

      if (requestId !== searchLoadRequest.current) return
      if (result.error) throw result.error
      if (!result.data?.id) throw new Error('Search preferences could not be saved.')

      searchProfileId.current = result.data.id
      setSearchForm({ min_intent_level: minIntentLevel, max_age_hours: maxAgeHours, active: payload.active })
      setSearchMessage('')
      setCurrentStep(5)
    } catch (error) {
      if (requestId === searchLoadRequest.current) {
        console.error('Unable to save search preferences:', error)
        setSearchMessage(error?.message || 'Unable to save search preferences.')
      }
    } finally {
      searchSavePending.current = false
      if (requestId === searchLoadRequest.current) setSearchSaving(false)
    }
  }

  const saveIdealOpportunities = async () => {
    if (idealSavePending.current || loading || profileLoadError) return

    setIdealMessage('')
    if (!workspaceId) {
      setIdealMessage('Workspace not found.')
      return
    }

    // Include typed values even if the user has not clicked Add yet.
    const preferences = createIdealForm({
      ...idealForm,
      target_countries: [...idealForm.target_countries, countryInput],
      ideal_client_types: [...idealForm.ideal_client_types, clientTypeInput],
      rejection_rules: [...idealForm.rejection_rules, rejectionRuleInput],
    })

    if (preferences.target_countries.length === 0) {
      setIdealMessage('Please add at least one target country.')
      return
    }
    if (preferences.ideal_client_types.length === 0) {
      setIdealMessage('Please add at least one ideal client type.')
      return
    }

    const requestId = profileLoadRequest.current
    idealSavePending.current = true
    setIdealSaving(true)

    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .update({
          ...preferences,
          good_opportunity_definition:
            preferences.good_opportunity_definition.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .select('id')
        .single()

      if (requestId !== profileLoadRequest.current) return
      if (error) throw error
      if (!data?.id) throw new Error('Business profile not found. Please save Step 1 first.')

      setIdealForm(preferences)
      setCountryInput('')
      setClientTypeInput('')
      setRejectionRuleInput('')
      setIdealMessage('Ideal opportunity preferences saved successfully.')
      setCurrentStep(4)
    } catch (error) {
      if (requestId === profileLoadRequest.current) {
        console.error('Unable to save ideal opportunities:', error)
        setIdealMessage(error?.message || 'Unable to save ideal opportunity preferences.')
      }
    } finally {
      idealSavePending.current = false
      if (requestId === profileLoadRequest.current) setIdealSaving(false)
    }
  }

  const saveService = async () => {
    if (serviceMutationPending) return

    setServicesMessageType('error')

    if (!workspace?.id) {
      setServicesMessage('Workspace not found.')
      return
    }

    if (!serviceForm.name.trim()) {
      setServicesMessage('Service name is required.')
      return
    }

    const minimumProjectValue =
      serviceForm.min_project_value === ''
        ? null
        : Number(serviceForm.min_project_value)

    if (
      minimumProjectValue !== null &&
      (!Number.isFinite(minimumProjectValue) || minimumProjectValue < 0)
    ) {
      setServicesMessage('Minimum project value must be a non-negative number.')
      return
    }

    setServiceSaving(true)
    setServicesMessage('')

    try {
      const keywords = serviceKeywordText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

      const problemsSolved = serviceProblemText
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)

      const payload = {
        workspace_id: workspace.id,
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        keywords,
        problems_solved: problemsSolved,
        min_project_value: minimumProjectValue,
        currency: serviceForm.currency || 'INR',
        active: serviceForm.active,
      }

      const response = editingService
        ? await supabase
            .from('services')
            .update(payload)
            .eq('id', editingService.id)
            .eq('workspace_id', workspace.id)
        : await supabase.from('services').insert(payload)

      if (response.error) throw response.error

      const refreshed = await loadServices()

      setShowServiceForm(false)
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
      setServiceKeywordText('')
      setServiceProblemText('')

      if (refreshed) {
        setServicesMessageType('success')
        setServicesMessage(
          editingService ? 'Service updated successfully.' : 'Service added successfully.'
        )
      } else {
        setServicesMessageType('error')
        setServicesMessage(
          `Service ${editingService ? 'updated' : 'added'}, but the list could not be refreshed. Please reload to see it.`
        )
      }
    } catch (error) {
      console.error('Unable to save service:', error)
      setServicesMessageType('error')
      setServicesMessage(error?.message || 'Unable to save service.')
    } finally {
      setServiceSaving(false)
    }
  }

  const toggleServiceActive = async (service) => {
    if (!workspace?.id || serviceMutationPending || showServiceForm) return

    setServiceTogglingId(service.id)
    setServicesMessage('')
    setServicesMessageType('error')

    try {
      const { error } = await supabase
        .from('services')
        .update({ active: !service.active })
        .eq('id', service.id)
        .eq('workspace_id', workspace.id)

      if (error) throw error

      const refreshed = await loadServices()
      const action = service.active ? 'deactivated' : 'activated'

      if (refreshed) {
        setServicesMessageType('success')
        setServicesMessage(`${service.name} ${action}.`)
      } else {
        setServicesMessageType('error')
        setServicesMessage(
          `${service.name} ${action}, but the list could not be refreshed. Please reload to see it.`
        )
      }
    } catch (error) {
      console.error('Unable to update service status:', error)
      setServicesMessageType('error')
      setServicesMessage(error?.message || 'Unable to update service status.')
    } finally {
      setServiceTogglingId(null)
    }
  }

  const completeOnboarding = async () => {
    if (completionPendingRef.current || portfolioMutationPendingRef.current || portfolioLoading || loading || profileLoadError) return

    if (!workspace?.id || !user?.id) {
      setPortfolioMessage('Workspace or authenticated user could not be found.')
      return
    }
    if (showPortfolioForm) {
      setPortfolioMessage('Please save or cancel your project draft before completing setup.')
      return
    }

    const requestId = profileLoadRequest.current
    completionPendingRef.current = true
    setCompletingSetup(true)
    setPortfolioMessage('')

    try {
      const completedAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('workspaces')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: completedAt,
        })
        .eq('id', workspace.id)
        .eq('owner_user_id', user.id)
        .select('id, name, owner_user_id, onboarding_completed, onboarding_completed_at')
        .single()

      if (requestId !== profileLoadRequest.current) return
      if (error) throw error
      if (
        data?.onboarding_completed !== true ||
        data.id !== workspace.id || data.owner_user_id !== user.id
      ) {
        throw new Error('The workspace was not marked as onboarded.')
      }

      try {
        await triggerAiQueryGeneration(workspace.id)
      } catch (queryGenerationError) {
        console.warn(
          'Onboarding completed, but AI query generation could not be started:',
          queryGenerationError
        )
      }

      if (typeof onComplete === 'function') {
        await onComplete(data)
      } else {
        window.location.reload()
      }
    } catch (error) {
      if (requestId === profileLoadRequest.current) {
        console.error('Unable to complete onboarding:', error)
        setPortfolioMessage(error?.message || 'Unable to complete setup. Please try again.')
      }
    } finally {
      completionPendingRef.current = false
      if (requestId === profileLoadRequest.current) setCompletingSetup(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (profileSavePending.current || loading || profileLoadError) return

    setMessage('')

    if (!workspaceId) {
      setMessage('Workspace not found.')
      return
    }

    if (!businessName.trim()) {
      setMessage('Please enter your business name.')
      return
    }

    if (!businessType) {
      setMessage('Please select your business type.')
      return
    }

    if (!primaryGoal.trim()) {
      setMessage('Please enter your primary goal.')
      return
    }

    const requestId = profileLoadRequest.current
    profileSavePending.current = true
    setSaving(true)

    const profileData = {
      workspace_id: workspaceId,
      business_name: businessName.trim(),
      business_type: businessType,
      website_url: websiteUrl.trim() || null,
      primary_goal: primaryGoal.trim(),
      preferred_language: preferredLanguage,
      updated_at: new Date().toISOString(),
    }

    try {
      // Step 1 updates only its own fields, preserving Step 3 answers.
      const { data: existingProfile, error: checkError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (requestId !== profileLoadRequest.current) return
      if (checkError) throw checkError

      const result = existingProfile
        ? await supabase
            .from('business_profiles')
            .update(profileData)
            .eq('id', existingProfile.id)
            .eq('workspace_id', workspaceId)
            .select('id')
            .single()
        : await supabase
            .from('business_profiles')
            .insert(profileData)
            .select('id')
            .single()

      if (requestId !== profileLoadRequest.current) return
      if (result.error) throw result.error
      if (!result.data?.id) throw new Error('Your business profile could not be saved.')

      setMessage('Profile saved successfully.')
      setCurrentStep(2)
    } catch (error) {
      if (requestId === profileLoadRequest.current) {
        console.error('Profile save error:', error)
        setMessage(error?.message || 'Unable to save your profile.')
      }
    } finally {
      profileSavePending.current = false
      if (requestId === profileLoadRequest.current) setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-slate-400">
        Loading onboarding...
      </div>
    )
  }

  if (profileLoadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h1 className="text-xl font-semibold">Unable to load onboarding</h1>
          <p role="alert" className="mt-3 text-sm text-red-300">{profileLoadError}</p>
          <p className="mt-3 text-sm text-slate-400">
            Please retry before editing so your saved answers are not overwritten.
          </p>
          <button
            type="button"
            onClick={() => void loadBusinessProfile()}
            className="mt-6 rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const generatedSearchQueries = buildSearchQueries()
  const activeServiceCount = services.filter((service) => service.active).length

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">

        <div className="mb-10">
          <p className="mb-2 text-sm font-medium text-violet-400">
            Opportunity Engine
          </p>

          <h1 className="text-4xl font-bold">
            Set up your opportunity engine
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Tell us about your business so we can personalize opportunity
            discovery, qualification and outreach.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Setup progress
            </span>

            <span className="text-sm font-medium text-violet-400">
              Step {currentStep} of 5
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${currentStep * 20}%` }}
            />
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Signed in as
            </p>

            <p className="mt-2 font-semibold">
              {user?.email}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Workspace
            </p>

            <p className="mt-2 font-semibold">
              {workspace?.name}
            </p>
          </div>
        </div>

        {currentStep === 1 && (
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-8"
          >
            <div className="mb-8">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 font-bold">
                1
              </span>

              <h2 className="mt-4 text-2xl font-bold">
                About You
              </h2>

              <p className="mt-2 text-slate-400">
                Help us understand who you are and what you're trying to achieve.
              </p>
            </div>

            <fieldset disabled={saving} className="grid gap-6 md:grid-cols-2">

              <Field label="Business / Freelancer Name" required>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Example: Bharat Digital"
                  className={inputClass}
                />
              </Field>

              <Field label="Business Type" required>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select business type</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="small_agency">Small Agency</option>
                  <option value="agency">Agency</option>
                  <option value="company">Company</option>
                </select>
              </Field>

              <Field label="Website">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className={inputClass}
                />
              </Field>

              <Field label="Preferred Language">
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className={inputClass}
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </Field>

            </fieldset>

            <div className="mt-6">
              <Field label="What is your main goal?" required>
                <textarea
                  rows="4"
                  disabled={saving || aiAssistField === 'main_goal'}
                  value={primaryGoal}
                  onChange={(e) => {
                    setPrimaryGoal(e.target.value)
                    setAiAssistMessage('')
                  }}
                  placeholder="Example: Find businesses that currently need WordPress, Shopify or website development services."
                  className={`${inputClass} resize-none`}
                />
              </Field>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">
                  Add a short goal first, then let AI expand it into a buyer-focused brief.
                </p>
                <button
                  type="button"
                  onClick={() => void handleAiAssist('main_goal')}
                  disabled={saving || Boolean(aiAssistField)}
                  className="rounded-lg border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiAssistField === 'main_goal' ? 'Generating...' : '✨ Generate with AI'}
                </button>
              </div>
            </div>

            {aiAssistMessage && currentStep === 1 && (
              <div className="mt-4 rounded-xl border border-violet-900 bg-violet-950/30 px-4 py-3 text-sm text-violet-200">
                {aiAssistMessage}
              </div>
            )}

            {message && (
              <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 px-7 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>

          </form>
        )}

        {currentStep === 2 && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 font-bold text-white">
                2
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-white">Your Services</h2>

                {!showServiceForm && (
                  <button
                    type="button"
                    onClick={openNewServiceForm}
                    disabled={serviceMutationPending}
                    className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Add Service
                  </button>
                )}
              </div>

              <p className="mt-2 text-slate-400">
                Tell us what services you provide. We'll use this information
                to find and score relevant opportunities.
              </p>
            </div>

            {aiAssistMessage && currentStep === 2 && (
              <div className="mb-5 rounded-xl border border-violet-900 bg-violet-950/30 px-4 py-3 text-sm text-violet-200">
                {aiAssistMessage}
              </div>
            )}

            {showServiceForm && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveService()
                }}
                className="mb-8 rounded-2xl border border-violet-700 bg-slate-950 p-6"
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {editingService ? 'Edit Service' : 'Add Service'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Describe what you provide so the engine can find
                      relevant opportunities.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Close service form"
                    disabled={serviceSaving}
                    onClick={() => {
                      setShowServiceForm(false)
                      setEditingService(null)
                      setServicesMessage('')
                    }}
                    className="text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>

                <fieldset
                  disabled={serviceSaving}
                  className="grid gap-5 md:grid-cols-2"
                >
                  <Field label="Service Name" required>
                    <input
                      type="text"
                      required
                      value={serviceForm.name}
                      onChange={(event) =>
                        setServiceForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Example: WordPress Development"
                      className={serviceInputClass}
                    />
                  </Field>

                  <Field label="Minimum Project Value">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={serviceForm.min_project_value}
                      onChange={(event) =>
                        setServiceForm((previous) => ({
                          ...previous,
                          min_project_value: event.target.value,
                        }))
                      }
                      placeholder="50000"
                      className={serviceInputClass}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Description">
                      <textarea
                        rows={3}
                        value={serviceForm.description}
                        onChange={(event) => {
                          setServiceForm((previous) => ({
                            ...previous,
                            description: event.target.value,
                          }))
                          setAiAssistMessage('')
                        }}
                        placeholder="Example: WordPress development, Elementor implementation and WooCommerce development."
                        className={`${serviceInputClass} resize-none`}
                      />
                    </Field>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs leading-5 text-slate-500">
                        AI can use the service name, keywords and problems you solve to create a clearer description.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleAiAssist('service_description')}
                        disabled={serviceSaving || Boolean(aiAssistField)}
                        className="rounded-lg border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {aiAssistField === 'service_description' ? 'Generating...' : '✨ Generate with AI'}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Field label="Search Keywords">
                      <input
                        type="text"
                        value={serviceKeywordText}
                        onChange={(event) => setServiceKeywordText(event.target.value)}
                        placeholder="WordPress, Elementor, WooCommerce, ACF"
                        className={serviceInputClass}
                      />
                    </Field>
                    <p className="mt-2 text-xs text-slate-500">
                      Separate keywords with commas.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <Field label="Problems You Solve">
                      <textarea
                        rows={4}
                        value={serviceProblemText}
                        onChange={(event) => setServiceProblemText(event.target.value)}
                        placeholder={'New WordPress website\nWebsite redesign\nWooCommerce development\nElementor troubleshooting'}
                        className={`${serviceInputClass} resize-none`}
                      />
                    </Field>
                    <p className="mt-2 text-xs text-slate-500">
                      Enter one problem per line or separate them with commas.
                    </p>
                  </div>

                  <Field label="Currency">
                    <select
                      value={serviceForm.currency}
                      onChange={(event) =>
                        setServiceForm((previous) => ({
                          ...previous,
                          currency: event.target.value,
                        }))
                      }
                      className={serviceInputClass}
                    >
                      {['INR', 'USD', 'GBP', 'EUR', 'AED', 'AUD'].map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-200">Status</p>
                    <label className="flex min-h-12.5 cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4">
                      <input
                        type="checkbox"
                        checked={serviceForm.active}
                        onChange={(event) =>
                          setServiceForm((previous) => ({
                            ...previous,
                            active: event.target.checked,
                          }))
                        }
                        className="accent-violet-600"
                      />
                      <span className="text-sm text-white">Active service</span>
                    </label>
                  </div>
                </fieldset>

                {servicesMessage && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300"
                  >
                    {servicesMessage}
                  </p>
                )}

                <div className="mt-7 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={serviceSaving}
                    onClick={() => {
                      setShowServiceForm(false)
                      setEditingService(null)
                      setServicesMessage('')
                    }}
                    className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={serviceSaving}
                    className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {serviceSaving
                      ? 'Saving...'
                      : editingService
                        ? 'Update Service'
                        : 'Save Service'}
                  </button>
                </div>
              </form>
            )}

            {servicesLoading ? (
              <p className="text-slate-400">Loading services...</p>
            ) : servicesMessage &&
              servicesMessageType === 'error' &&
              services.length === 0 ? null : services.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <p className="font-semibold text-white">No services added yet.</p>
                <p className="mt-2 text-sm text-slate-400">
                  Add your first service so the opportunity engine knows
                  what work to look for.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {service.name}
                        </h3>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            service.active
                              ? 'border-emerald-800 bg-emerald-950 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }`}
                        >
                          {service.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => openEditService(service)}
                          disabled={serviceMutationPending || showServiceForm}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleServiceActive(service)}
                          disabled={serviceMutationPending || showServiceForm}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            service.active
                              ? 'border-amber-800 text-amber-300 hover:bg-amber-950'
                              : 'border-emerald-800 text-emerald-300 hover:bg-emerald-950'
                          }`}
                        >
                          {serviceTogglingId === service.id
                            ? 'Updating...'
                            : service.active
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      </div>
                    </div>

                    {service.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {service.description}
                      </p>
                    )}

                    {Array.isArray(service.keywords) &&
                      service.keywords.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {service.keywords.map((keyword, index) => (
                            <span
                              key={`${keyword}-${index}`}
                              className="rounded-full border border-violet-900 bg-violet-950/50 px-3 py-1 text-xs text-violet-300"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}

                    {service.min_project_value != null && (
                      <p className="mt-4 text-sm text-slate-400">
                        Minimum project:{' '}
                        <span className="font-medium text-white">
                          {service.currency || 'USD'}{' '}
                          {Number(service.min_project_value).toLocaleString()}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {servicesMessage && !showServiceForm && (
              <div
                role={servicesMessageType === 'success' ? 'status' : 'alert'}
                className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                  servicesMessageType === 'success'
                    ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
                    : 'border-red-900 bg-red-950/30 text-red-300'
                }`}
              >
                {servicesMessage}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                disabled={serviceMutationPending}
                className="rounded-xl border border-slate-700 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentStep(3)

                  if (
                    idealForm.ideal_client_types.length === 0 ||
                    idealForm.rejection_rules.length === 0
                  ) {
                    void handleAiAssist('profile_filters')
                  }
                }}
                disabled={
                  servicesLoading ||
                  serviceMutationPending ||
                  showServiceForm ||
                  services.length === 0
                }
                className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save &amp; Continue
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void saveIdealOpportunities()
            }}
            className="rounded-3xl border border-slate-800 bg-slate-900 p-8"
          >
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 font-semibold">
                3
              </div>
              <h2 className="text-3xl font-bold">Ideal Opportunities</h2>
              <p className="mt-2 text-slate-400">
                Tell us what kinds of clients and opportunities you want the engine to prioritize.
              </p>
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-900/50 bg-violet-950/20 p-4">
              <div>
                <p className="font-medium text-violet-100">
                  AI Targeting Assistant
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Automatically infer ideal client types and rejection rules from your goal and services.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAiAssist('profile_filters')}
                disabled={idealSaving || Boolean(aiAssistField)}
                className="rounded-lg border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiAssistField === 'profile_filters'
                  ? 'Generating targeting...'
                  : '✨ Auto-fill Targeting with AI'}
              </button>
            </div>

            <fieldset disabled={idealSaving} className="space-y-8">
              <IdealTagField
                field="target_countries"
                label="Target Countries"
                required
                description="Where would you like to find clients?"
                placeholder="Example: USA"
                value={countryInput}
                onChange={setCountryInput}
                items={idealForm.target_countries}
                onAdd={addUniqueItem}
                onRemove={removeItem}
              />
              <IdealTagField
                field="ideal_client_types"
                label="Ideal Client Types"
                required
                description="What types of businesses or clients do you prefer?"
                placeholder="Example: Digital agencies"
                value={clientTypeInput}
                onChange={setClientTypeInput}
                items={idealForm.ideal_client_types}
                onAdd={addUniqueItem}
                onRemove={removeItem}
              />
              <IdealTagField
                field="rejection_rules"
                label="Opportunities to Avoid"
                description="Add situations the engine should reject or deprioritize."
                placeholder="Example: Unpaid projects"
                value={rejectionRuleInput}
                onChange={setRejectionRuleInput}
                items={idealForm.rejection_rules}
                onAdd={addUniqueItem}
                onRemove={removeItem}
              />
              <div>
                <Field label="Describe a Good Opportunity">
                  <textarea
                    rows={5}
                    value={idealForm.good_opportunity_definition}
                    onChange={(event) => {
                      setIdealForm((previous) => ({
                        ...previous,
                        good_opportunity_definition: event.target.value,
                      }))
                      setIdealMessage('')
                      setAiAssistMessage('')
                    }}
                    placeholder="Example: A business owner, startup or agency actively looking for someone to build, redesign or improve a website and willing to hire an external freelancer or agency."
                    className={`${inputClass} resize-none`}
                  />
                </Field>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-slate-500">
                    AI will combine your target markets, ideal clients, services and rejection rules into a qualification brief.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleAiAssist('good_opportunity')}
                    disabled={idealSaving || Boolean(aiAssistField)}
                    className="rounded-lg border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {aiAssistField === 'good_opportunity' ? 'Generating...' : '✨ Generate with AI'}
                  </button>
                </div>
              </div>
            </fieldset>

            {aiAssistMessage && currentStep === 3 && (
              <p className="mt-6 rounded-xl border border-violet-900 bg-violet-950/30 px-4 py-3 text-sm text-violet-200">
                {aiAssistMessage}
              </p>
            )}

            {idealMessage && (
              <p role="alert" className="mt-6 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {idealMessage}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={idealSaving}
                className="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={idealSaving}
                className="rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {idealSaving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </form>
        )}

        {currentStep === 4 && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void saveSearchPreferences()
            }}
            className="rounded-3xl border border-slate-800 bg-slate-900 p-8 md:p-10"
          >
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-lg font-bold">
                4
              </div>
              <h2 className="text-3xl font-bold">Search Preferences</h2>
              <p className="mt-3 text-slate-400">
                Control how selective and fresh your opportunity discovery should be.
              </p>
            </div>

            {searchLoading && <p role="status" className="mb-6 text-sm text-slate-400">Loading search preferences...</p>}
            {searchLoadError && (
              <div className="mb-6 rounded-xl border border-red-900 bg-red-950/30 p-4">
                <p role="alert" className="text-sm text-red-300">{searchLoadError}</p>
                <button
                  type="button"
                  onClick={() => void loadSearchProfile()}
                  disabled={searchSaving}
                  className="mt-3 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  Retry Loading
                </button>
              </div>
            )}

            <fieldset disabled={searchSaving || searchLoading || Boolean(searchLoadError)}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Field label="Minimum Buying Intent">
                    <select
                      value={searchForm.min_intent_level}
                      onChange={(event) => {
                        setSearchForm((previous) => ({ ...previous, min_intent_level: Number(event.target.value) }))
                        setSearchMessage('')
                      }}
                      className={inputClass}
                    >
                      {![2, 3, 4, 5].includes(searchForm.min_intent_level) && (
                        <option value={searchForm.min_intent_level}>{searchForm.min_intent_level} — Existing setting</option>
                      )}
                      <option value={2}>2 — Possible interest</option>
                      <option value={3}>3 — Credible requirement</option>
                      <option value={4}>4 — Clearly looking to hire</option>
                      <option value={5}>5 — Very strong / urgent intent</option>
                    </select>
                  </Field>
                  <p className="mt-2 text-sm text-slate-500">Higher intent produces fewer but stronger opportunities.</p>
                </div>
                <div>
                  <Field label="Opportunity Freshness">
                    <select
                      value={searchForm.max_age_hours}
                      onChange={(event) => {
                        setSearchForm((previous) => ({ ...previous, max_age_hours: Number(event.target.value) }))
                        setSearchMessage('')
                      }}
                      className={inputClass}
                    >
                      {![24, 48, 72, 168].includes(searchForm.max_age_hours) && (
                        <option value={searchForm.max_age_hours}>Last {searchForm.max_age_hours} hours — Existing setting</option>
                      )}
                      <option value={24}>Last 24 hours</option>
                      <option value={48}>Last 2 days</option>
                      <option value={72}>Last 3 days</option>
                      <option value={168}>Last 7 days</option>
                    </select>
                  </Field>
                  <p className="mt-2 text-sm text-slate-500">Older opportunities are more likely to already be filled.</p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="font-semibold">Target Countries</h3>
                <p className="mt-1 text-sm text-slate-400">Inherited from your Ideal Opportunities settings.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {idealForm.target_countries.length > 0 ? idealForm.target_countries.map((country) => (
                    <span key={country} className="rounded-full border border-violet-700 bg-violet-950 px-3 py-1 text-sm text-violet-200">
                      {country}
                    </span>
                  )) : <span className="text-sm text-slate-500">No target countries selected.</span>}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <h3 className="font-semibold">Discovery Configuration</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-slate-500">Active Services</p>
                    <p className="mt-1 text-2xl font-bold">{activeServiceCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Search Patterns</p>
                    <p className="mt-1 text-2xl font-bold">{generatedSearchQueries.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Search Status</p>
                    <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm ${
                      searchForm.active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {searchForm.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>
                {servicesLoading ? (
                  <p role="status" className="mt-4 text-sm text-slate-400">Loading services...</p>
                ) : generatedSearchQueries.length === 0 && (
                  <p className="mt-4 text-sm text-amber-300">Add or activate a service in Step 2 before continuing.</p>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <div>
                  <h3 id="discovery-toggle-label" className="font-semibold">Opportunity Discovery</h3>
                  <p className="mt-1 text-sm text-slate-400">Turn this off if you want to temporarily pause searches.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={searchForm.active}
                  aria-labelledby="discovery-toggle-label"
                  onClick={() => {
                    setSearchForm((previous) => ({ ...previous, active: !previous.active }))
                    setSearchMessage('')
                  }}
                  className={`relative h-7 w-14 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 disabled:opacity-50 ${
                    searchForm.active ? 'bg-violet-600' : 'bg-slate-700'
                  }`}
                >
                  <span aria-hidden="true" className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${searchForm.active ? 'left-8' : 'left-1'}`} />
                </button>
              </div>
            </fieldset>

            {searchMessage && !searchLoadError && (
              <p role="alert" className="mt-6 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{searchMessage}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIdealMessage('')
                  setCurrentStep(3)
                }}
                disabled={searchSaving}
                className="rounded-xl border border-slate-700 px-6 py-3 font-semibold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={searchSaving || searchLoading || Boolean(searchLoadError) || servicesLoading || serviceMutationPending || generatedSearchQueries.length === 0}
                className="rounded-xl bg-violet-600 px-7 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchSaving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </form>
        )}

        {currentStep === 5 && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 md:p-10">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
              <div className="flex-1">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-lg font-bold">
                  5
                </div>
                <h2 className="text-3xl font-bold">Proof &amp; Profiles</h2>
                <p className="mt-3 text-slate-400">
                  Add links or evidence that show what you can do — for example Dribbble, Behance, YouTube, LinkedIn, GitHub, your website, case studies, publications or client work.
                </p>
              </div>
              {!showPortfolioForm && (
                <button
                  type="button"
                  onClick={openNewPortfolioForm}
                  disabled={portfolioMutationPending || portfolioLoading || Boolean(portfolioLoadError)}
                  className="rounded-xl bg-violet-600 px-5 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 md:mt-14"
                >
                  + Add Proof / Profile
                </button>
              )}
            </div>

            {showPortfolioForm && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void savePortfolioItem()
                }}
                className="mb-8 rounded-2xl border border-violet-800 bg-slate-950 p-6"
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {editingPortfolioId ? 'Edit Proof / Profile' : 'Add Proof / Profile'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Add evidence AI can safely use to understand your credibility and personalize outreach.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close portfolio form"
                    onClick={cancelPortfolioForm}
                    disabled={portfolioSaving}
                    className="text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    &times;
                  </button>
                </div>

                <fieldset disabled={portfolioSaving} className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Field label="Proof Type" required>
                      <select
                        value={portfolioForm.proof_type}
                        onChange={(event) => {
                          setPortfolioForm((previous) => ({
                            ...previous,
                            proof_type: event.target.value,
                          }))
                          setPortfolioMessage('')
                        }}
                        className={serviceInputClass}
                      >
                        <option value="profile">Profile / Portfolio Link</option>
                        <option value="project">Project / Work Sample</option>
                        <option value="case_study">Case Study</option>
                        <option value="publication">Publication / Article</option>
                        <option value="testimonial">Testimonial / Review</option>
                        <option value="certification">Certification / Credential</option>
                        <option value="other">Other Proof</option>
                      </select>
                    </Field>
                  </div>

                  <div>
                    <Field label="Platform">
                      <input
                        value={portfolioForm.platform}
                        onChange={(event) => {
                          setPortfolioForm((previous) => ({
                            ...previous,
                            platform: event.target.value,
                          }))
                          setPortfolioMessage('')
                        }}
                        placeholder="Dribbble, Behance, YouTube, LinkedIn, GitHub..."
                        className={serviceInputClass}
                      />
                    </Field>
                  </div>

                  {[
                    { field: 'project_name', label: 'Title', placeholder: 'Example: Brand Identity Portfolio', required: true },
                    { field: 'client_name', label: 'Client / Organization (optional)', placeholder: 'Example: Acme Studio' },
                    { field: 'industry', label: 'Industry / Category (optional)', placeholder: 'Branding, Legal, Ecommerce, Healthcare...' },
                    { field: 'project_url', label: 'Link / Profile URL', placeholder: 'https://dribbble.com/username', type: 'url' },
                    { field: 'services', label: 'Services Represented', placeholder: 'Logo Design, PPC, Legal Advisory, Video Editing', help: 'Separate services with commas.' },
                    { field: 'technologies', label: 'Skills / Topics / Tools', placeholder: 'Brand Identity, Meta Ads, Contract Law, Premiere Pro', help: 'Separate items with commas.' },
                  ].map(({ field, label, placeholder, required, type, help }) => (
                    <div key={field}>
                      <Field label={label} required={required}>
                        <input
                          type={type || 'text'}
                          required={required}
                          value={portfolioForm[field]}
                          onChange={(event) => {
                            setPortfolioForm((previous) => ({ ...previous, [field]: event.target.value }))
                            setPortfolioMessage('')
                          }}
                          placeholder={placeholder}
                          className={serviceInputClass}
                        />
                      </Field>
                      {help && <p className="mt-2 text-xs text-slate-500">{help}</p>}
                    </div>
                  ))}

                  <div className="md:col-span-2">
                    <Field label="Description">
                      <textarea
                        rows={4}
                        value={portfolioForm.summary}
                        onChange={(event) => {
                          setPortfolioForm((previous) => ({ ...previous, summary: event.target.value }))
                          setPortfolioMessage('')
                        }}
                        placeholder="Explain what this proof shows and why it demonstrates your capability."
                        className={`${serviceInputClass} resize-none`}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Evidence / Proof Points">
                      <textarea
                        rows={5}
                        value={portfolioForm.proof_points}
                        onChange={(event) => {
                          setPortfolioForm((previous) => ({ ...previous, proof_points: event.target.value }))
                          setPortfolioMessage('')
                        }}
                        placeholder={'Campaign improved qualified leads\nPublished work demonstrates expertise\nProfile contains relevant work samples'}
                        className={`${serviceInputClass} resize-none`}
                      />
                    </Field>
                    <p className="mt-2 text-xs text-slate-500">Add one proof point per line.</p>
                  </div>
                </fieldset>

                {portfolioMessage && (
                  <p role="alert" className="mt-5 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                    {portfolioMessage}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={cancelPortfolioForm}
                    disabled={portfolioSaving}
                    className="rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={portfolioSaving}
                    className="rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {portfolioSaving ? 'Saving...' : editingPortfolioId ? 'Update Proof' : 'Add Proof'}
                  </button>
                </div>
              </form>
            )}

            {portfolioLoading ? (
              <p role="status" className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-400">
                Loading proof & profiles...
              </p>
            ) : portfolioLoadError ? (
              <div className="rounded-xl border border-red-900 bg-red-950/30 p-6">
                <p role="alert" className="text-sm text-red-300">{portfolioMessage}</p>
                <button
                  type="button"
                  onClick={() => void loadPortfolioItems()}
                  disabled={portfolioMutationPending || showPortfolioForm}
                  className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry Loading
                </button>
              </div>
            ) : portfolioItems.length > 0 ? (
              <div className="space-y-4">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold">{item.project_name || 'Untitled proof'}</h3>
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs capitalize text-slate-300">
                          {(item.proof_type || 'project').replaceAll('_', ' ')}
                        </span>
                        {item.platform && (
                          <span className="rounded-full border border-violet-700 bg-violet-950 px-3 py-1 text-xs text-violet-200">
                            {item.platform}
                          </span>
                        )}
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => editPortfolioItem(item)}
                          disabled={portfolioMutationPending || showPortfolioForm}
                          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePortfolioActive(item)}
                          disabled={portfolioMutationPending || showPortfolioForm}
                          className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                            item.active
                              ? 'border-rose-900 text-rose-300 hover:bg-rose-950'
                              : 'border-emerald-900 text-emerald-300 hover:bg-emerald-950'
                          }`}
                        >
                          {portfolioTogglingId === item.id ? 'Updating...' : item.active ? 'Disable' : 'Activate'}
                        </button>
                      </div>
                    </div>
                    {item.client_name && <p className="mt-2 text-sm text-slate-400">Client: {item.client_name}</p>}
                    {item.industry && <p className="mt-1 text-sm text-slate-400">Industry: {item.industry}</p>}
                    {item.summary && <p className="mt-4 whitespace-pre-line text-slate-300">{item.summary}</p>}

                    {normalizeIdealItems(item.services).length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Services</p>
                        <div className="flex flex-wrap gap-2">
                          {normalizeIdealItems(item.services).map((service) => (
                            <span key={service} className="rounded-full border border-violet-700 bg-violet-950 px-3 py-1 text-sm text-violet-200">
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {normalizeIdealItems(item.technologies).length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Skills / Topics / Tools</p>
                        <div className="flex flex-wrap gap-2">
                          {normalizeIdealItems(item.technologies).map((technology) => (
                            <span key={technology} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                              {technology}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <h3 className="font-semibold">No portfolio projects yet</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Portfolio projects are optional, but they improve opportunity matching and outreach quality.
                </p>
              </div>
            )}

            {portfolioMessage && !showPortfolioForm && !portfolioLoadError && (
              <p role="alert" className="mt-6 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {portfolioMessage}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearchMessage('')
                  setCurrentStep(4)
                }}
                disabled={portfolioMutationPending}
                className="rounded-xl border border-slate-700 px-6 py-3 font-semibold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={completeOnboarding}
                disabled={portfolioMutationPending || portfolioLoading || showPortfolioForm}
                className="rounded-xl bg-violet-600 px-7 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {completingSetup ? 'Completing Setup...' : 'Complete Setup'}
              </button>
            </div>
            {showPortfolioForm && (
              <p className="mt-3 text-sm text-slate-500">Save or cancel your project draft before completing setup.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IdealTagField({
  field, label, required = false, description, placeholder,
  value, onChange, items, onAdd, onRemove,
}) {
  const inputId = `ideal-${field}`
  const addItem = () => {
    onAdd(field, value)
    onChange('')
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block font-medium">
        {label}{required && <span className="ml-1 text-violet-400">*</span>}
      </label>
      <p className="mb-3 text-sm text-slate-400">{description}</p>
      <div className="flex gap-3">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              addItem()
            }
          }}
          placeholder={placeholder}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!value.trim()}
          aria-label={`Add ${label.toLowerCase()}`}
          className="rounded-xl bg-violet-600 px-5 font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => onRemove(field, item)}
            aria-label={`Remove ${item}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              field === 'rejection_rules'
                ? 'border-red-900 bg-red-950/40 text-red-300'
                : 'border-violet-700 bg-violet-950 text-violet-200'
            }`}
          >
            {item} <span aria-hidden="true">&times;</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">
        {label}

        {required && (
          <span className="ml-1 text-violet-400">*</span>
        )}
      </span>

      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500'

const serviceInputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500'

export default Onboarding
