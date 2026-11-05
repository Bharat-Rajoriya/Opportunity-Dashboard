-- AI Classification Performance V2
-- Technical AI failures are NOT evidence of poor acquisition-source quality.
-- Preserve existing events and the shape of the metrics view.
alter table public.source_candidate_events
  drop constraint if exists source_candidate_events_event_type_check;
alter table public.source_candidate_events
  add constraint source_candidate_events_event_type_check
  check (event_type in ('evaluated','rejected','qualified','duplicate','created','classification_error'));

create or replace view public.source_strategy_metrics_v1
with (security_invoker=true)
as
with sources as (
  select unnest(array['google'::text,'freelancer'::text]) as source
)
select
  w.id as workspace_id,
  s.source,
  greatest(
    count(e.id) filter (where e.event_type = 'evaluated') -
    count(e.id) filter (where e.event_type = 'classification_error'), 0
  )::integer as evaluated,
  count(e.id) filter (where e.event_type = 'qualified')::integer as qualified,
  count(e.id) filter (where e.event_type = 'rejected')::integer as rejected,
  count(e.id) filter (where e.event_type = 'duplicate')::integer as duplicates,
  count(e.id) filter (where e.event_type = 'created')::integer as created,
  round(avg(e.preliminary_score) filter
    (where e.event_type='qualified' and e.preliminary_score is not null),2)
    as average_preliminary_score
from public.workspaces w
cross join sources s
left join public.source_candidate_events e
 on e.workspace_id=w.id
 and e.source=s.source
 and e.created_at >= now()-interval '30 days'
group by w.id,s.source;
