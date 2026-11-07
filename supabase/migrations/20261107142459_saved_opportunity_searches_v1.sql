-- Applied to Supabase project vetnjqadmajyweebmxxi as migration 20261107142459.
-- This table intentionally does not control external acquisition or schedule alerts.
create table if not exists public.saved_opportunity_searches (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 80),
 query text not null default '' check (char_length(query) <= 500),
 source text not null default 'all' check (char_length(source) <= 80),
 recency text not null default 'all' check (recency in ('all','24','168','720')),
 min_score text not null default 'all' check (min_score in ('all','60','70','80')),
 country text not null default 'all' check (char_length(country) <= 120),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,name)
);
create index if not exists saved_opportunity_searches_workspace_recent
 on public.saved_opportunity_searches(workspace_id,created_at desc);
alter table public.saved_opportunity_searches enable row level security;
do $$
begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_opportunity_searches' and policyname='Read saved searches in owned workspace') then
  create policy "Read saved searches in owned workspace" on public.saved_opportunity_searches for select to authenticated
   using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_opportunity_searches' and policyname='Create saved searches in owned workspace') then
  create policy "Create saved searches in owned workspace" on public.saved_opportunity_searches for insert to authenticated
   with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_opportunity_searches' and policyname='Update saved searches in owned workspace') then
  create policy "Update saved searches in owned workspace" on public.saved_opportunity_searches for update to authenticated
   using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
   with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_opportunity_searches' and policyname='Delete saved searches in owned workspace') then
  create policy "Delete saved searches in owned workspace" on public.saved_opportunity_searches for delete to authenticated
   using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
 end if;
end $$;
grant select,insert,update,delete on public.saved_opportunity_searches to authenticated;
