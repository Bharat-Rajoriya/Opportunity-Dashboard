drop policy if exists "Users can view own workspace" on public.workspaces;
drop policy if exists "Users can update own workspace" on public.workspaces;

drop policy if exists "Users can view own source analytics" on public.source_candidate_events;
create policy "Users can view own source analytics"
on public.source_candidate_events
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = source_candidate_events.workspace_id
      and w.owner_user_id = (select auth.uid())
  )
);
