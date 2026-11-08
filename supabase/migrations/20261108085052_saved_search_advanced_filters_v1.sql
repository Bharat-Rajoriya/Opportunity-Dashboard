-- Advanced saved-filter presets only. Does not change acquisition profiles or opportunity records.
-- Existing saved searches retain all-results defaults for backward compatibility.
alter table public.saved_opportunity_searches
 add column if not exists budget_evidence text not null default 'all'
   check (budget_evidence in ('all','listed','estimated','unknown')),
 add column if not exists project_kind text not null default 'all'
   check (project_kind in ('all','fixed','hourly','ongoing','other','unknown')),
 add column if not exists work_mode text not null default 'all'
   check (work_mode in ('all','remote','onsite','hybrid','unknown'));
