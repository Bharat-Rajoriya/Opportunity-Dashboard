-- Backend Stability V3: auditable outreach state transitions.
-- Applied to the production Supabase project on 2026-11-04.
-- Idempotent: safe for fresh environments and reruns.
create table if not exists public.outreach_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('user','backend')),
  event_type text not null check (event_type in ('draft_changed','review_changed','marked_sent','outreach_status_changed')),
  from_value text,
  to_value text,
  recommended_action_at_event text,
  total_score_at_event numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_outreach_audit_by_opportunity
 on public.outreach_audit_events (workspace_id, opportunity_id, created_at desc);
alter table public.outreach_audit_events enable row level security;
revoke all on table public.outreach_audit_events from anon, authenticated;
grant select on table public.outreach_audit_events to authenticated;
grant select, insert on table public.outreach_audit_events to service_role;
drop policy if exists "Workspace owners read outreach audits" on public.outreach_audit_events;
create policy "Workspace owners read outreach audits"
on public.outreach_audit_events for select to authenticated
using (exists (
 select 1 from public.workspaces w
 where w.id = outreach_audit_events.workspace_id
 and w.owner_user_id = (select auth.uid())
));

create or replace function public.log_opportunity_outreach_changes()
returns trigger language plpgsql
security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
 if new.outreach_message is distinct from old.outreach_message and
    new.outreach_message is not null and length(btrim(new.outreach_message)) > 0 then
   insert into public.outreach_audit_events
    (workspace_id, opportunity_id, actor_user_id, actor_type, event_type, from_value, to_value, recommended_action_at_event, total_score_at_event)
   values (new.workspace_id, new.id, actor,
      case when actor is null then 'backend' else 'user' end,
      'draft_changed',
      case when old.outreach_message is null then 'none' else 'existing_draft' end,
      'draft_updated', new.recommended_action, new.total_score);
 end if;
 if new.outreach_review_status is distinct from old.outreach_review_status then
   insert into public.outreach_audit_events
    (workspace_id, opportunity_id, actor_user_id, actor_type, event_type, from_value, to_value, recommended_action_at_event, total_score_at_event)
   values (new.workspace_id, new.id, actor,
      case when actor is null then 'backend' else 'user' end,
      'review_changed', old.outreach_review_status, new.outreach_review_status,
      new.recommended_action, new.total_score);
 end if;
 if new.outreach_status is distinct from old.outreach_status then
   insert into public.outreach_audit_events
    (workspace_id, opportunity_id, actor_user_id, actor_type, event_type, from_value, to_value, recommended_action_at_event, total_score_at_event)
   values (new.workspace_id, new.id, actor,
      case when actor is null then 'backend' else 'user' end,
      case when new.outreach_status = 'sent' then 'marked_sent' else 'outreach_status_changed' end,
      old.outreach_status, new.outreach_status, new.recommended_action, new.total_score);
 end if;
 return new;
end;
$$;
revoke all on function public.log_opportunity_outreach_changes() from public, anon, authenticated;
drop trigger if exists trg_opportunity_outreach_audit on public.opportunities;
create trigger trg_opportunity_outreach_audit
after update of outreach_message, outreach_review_status, outreach_status on public.opportunities
for each row execute function public.log_opportunity_outreach_changes();
