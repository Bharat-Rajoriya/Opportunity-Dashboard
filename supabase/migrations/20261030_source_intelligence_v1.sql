create table if not exists public.source_candidate_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  search_profile_id uuid references public.search_profiles(id) on delete set null,
  master_execution_id text not null,
  source text not null,
  source_environment text not null default 'production',
  source_item_id text,
  candidate_key text,
  event_type text not null check (
    event_type in ('evaluated', 'rejected', 'qualified', 'duplicate', 'created')
  ),
  search_query text,
  gate_reason text,
  source_result_type text,
  source_quality_score numeric,
  buyer_likelihood text,
  intent_level integer,
  preliminary_score numeric,
  created_at timestamptz not null default now()
);

create index if not exists source_candidate_events_workspace_created_idx
  on public.source_candidate_events (workspace_id, created_at desc);

create index if not exists source_candidate_events_workspace_source_created_idx
  on public.source_candidate_events (workspace_id, source, created_at desc);

create index if not exists source_candidate_events_execution_idx
  on public.source_candidate_events (master_execution_id);

alter table public.source_candidate_events enable row level security;

drop policy if exists "Users can view own source analytics" on public.source_candidate_events;

create policy "Users can view own source analytics"
  on public.source_candidate_events
  for select
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = source_candidate_events.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );
