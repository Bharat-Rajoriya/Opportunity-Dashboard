alter table public.opportunities
  add column if not exists scope_complexity text,
  add column if not exists scope_reason text,
  add column if not exists scope_multiplier numeric,
  add column if not exists scope_adjusted_min_value numeric,
  add column if not exists scope_budget_fit_ratio numeric,
  add column if not exists scope_budget_fit text,
  add column if not exists scope_budget_fit_reason text;
