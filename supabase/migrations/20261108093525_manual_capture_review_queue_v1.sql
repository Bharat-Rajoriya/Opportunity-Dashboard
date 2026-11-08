-- Manual public-link review queue. This does not insert or classify opportunities.
create table public.manual_capture_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_url text not null check (length(source_url) between 10 and 2000 and source_url ~* '^https://[^[:space:]]+$'),
  title text not null check (length(btrim(title)) between 4 and 180),
  requirement text not null check (length(btrim(requirement)) between 20 and 5000),
  source_platform text not null default 'other' check (source_platform in ('freelancer','upwork','other')),
  status text not null default 'needs_review' check (status in ('needs_review','dismissed')),
  created_at timestamptz not null default now(),
  unique (workspace_id,source_url)
);
create index manual_capture_reviews_workspace on public.manual_capture_reviews (workspace_id,created_at desc);
alter table public.manual_capture_reviews enable row level security;
create policy "Owner select manual captures" on public.manual_capture_reviews for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_user_id = (select auth.uid())));
create policy "Owner insert manual captures" on public.manual_capture_reviews for insert to authenticated
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_user_id = (select auth.uid())));
create policy "Owner update manual captures" on public.manual_capture_reviews for update to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_user_id = (select auth.uid())));
create policy "Owner delete manual captures" on public.manual_capture_reviews for delete to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_user_id = (select auth.uid())));
grant select,insert,update,delete on public.manual_capture_reviews to authenticated;
revoke all on public.manual_capture_reviews from anon;
