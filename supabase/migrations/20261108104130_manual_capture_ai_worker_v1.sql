
-- PR71: terminal, auditable manual-capture AI outcomes (no autonomous paid runs).
alter table public.manual_capture_reviews drop constraint manual_capture_reviews_status_check;
alter table public.manual_capture_reviews add constraint manual_capture_reviews_status_check
 check (status in ('needs_review','dismissed','pending_qualification','qualifying','qualified','rejected','duplicate','failed'));
alter table public.manual_capture_reviews
 add column if not exists qualification_started_at timestamptz,
 add column if not exists qualification_finished_at timestamptz,
 add column if not exists qualification_lease uuid,
 add column if not exists qualification_attempts integer not null default 0,
 add column if not exists qualification_result jsonb,
 add column if not exists qualification_reason text,
 add column if not exists qualified_opportunity_id uuid references public.opportunities(id) on delete set null;
create index if not exists manual_capture_qualification_work on public.manual_capture_reviews(workspace_id,status,created_at);

-- Existing authenticated update policies are broad. Block client edits to
-- machine outcome/lease fields, while retaining ordinary review/dismiss behavior.
create or replace function public.guard_manual_capture_client_update()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user = 'authenticated' then
   if ((to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')) or
      not ((old.status='needs_review' and new.status='dismissed') or
           (old.status='dismissed' and new.status='needs_review') or
           new.status=old.status) then
     raise exception 'manual_capture_machine_fields_are_server_managed';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists manual_capture_client_guard on public.manual_capture_reviews;
create trigger manual_capture_client_guard before update on public.manual_capture_reviews
for each row execute function public.guard_manual_capture_client_update();

-- Previous submit RPC explicitly checks auth.uid and owner. Run as definer only
-- to cross the client-only mutation guard above, never expose general update.
alter function public.submit_manual_capture_for_qualification(uuid,uuid) security definer;
alter function public.submit_manual_capture_for_qualification(uuid,uuid) set search_path=public,pg_temp;

create or replace function public.claim_manual_capture_qualification(p_workspace_id uuid,p_capture_id uuid)
returns public.manual_capture_reviews
language plpgsql security definer set search_path=public,pg_temp as $$
declare capture public.manual_capture_reviews%rowtype;
begin
 if auth.uid() is null or not exists (select 1 from public.workspaces w where w.id=p_workspace_id and w.owner_user_id=auth.uid())
   then raise exception 'workspace_not_authorized'; end if;
 select * into capture from public.manual_capture_reviews
  where id=p_capture_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'capture_not_found'; end if;
 if capture.status <> 'pending_qualification' or capture.qualification_attempts >= 2 then
  raise exception 'capture_not_pending'; end if;
 update public.manual_capture_reviews set status='qualifying',
   qualification_started_at=now(), qualification_lease=gen_random_uuid(),
   qualification_attempts=qualification_attempts+1,qualification_reason=null
 where id=capture.id returning * into capture;
 return capture;
end $$;
revoke all on function public.claim_manual_capture_qualification(uuid,uuid) from public,anon;
grant execute on function public.claim_manual_capture_qualification(uuid,uuid) to authenticated;

-- Service-role-only, atomic decision and opportunity insertion. Never trust a
-- model's score or claimed service ID without validating against workspace rows.
create or replace function public.finish_manual_capture_qualification(
 p_workspace_id uuid,p_capture_id uuid,p_lease uuid,p_analysis jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 c public.manual_capture_reviews%rowtype;
 sid uuid;
 v_kind text; v_fit text; v_likelihood text; v_eligibility text;
 v_confidence numeric; v_intent integer; v_reason text;
 v_pass boolean; v_fingerprint text; v_url text;
 existing_id uuid; new_id uuid; v_status text; v_source text;
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 select * into c from public.manual_capture_reviews
  where workspace_id=p_workspace_id and id=p_capture_id for update;
 if not found or c.status <> 'qualifying' or c.qualification_lease is distinct from p_lease
   then raise exception 'qualification_lease_not_current'; end if;
 if c.qualification_started_at < now()-interval '180 seconds'
   then raise exception 'qualification_lease_expired'; end if;
 if p_analysis->>'capture_id' is distinct from c.id::text or
    p_analysis->>'workspace_id' is distinct from c.workspace_id::text
   then raise exception 'qualification_response_identity_mismatch'; end if;

 v_kind=coalesce(p_analysis->>'source_result_type','unknown');
 v_fit=coalesce(p_analysis->>'service_match','none');
 v_likelihood=coalesce(p_analysis->>'buyer_likelihood','none');
 v_eligibility=coalesce(p_analysis->>'eligibility','unknown');
 v_confidence=least(1,greatest(0,coalesce(nullif(p_analysis->>'confidence','')::numeric,0)));
 v_intent=least(4,greatest(1,coalesce(nullif(p_analysis->>'intent_level','')::integer,1)));
 v_reason=left(coalesce(p_analysis->>'reason','No reliable buyer evidence.'),500);
 begin sid=nullif(p_analysis->>'matched_service_id','')::uuid;
 exception when invalid_text_representation then sid=null;
 end;
 if sid is not null and not exists(select 1 from public.services s where s.workspace_id=p_workspace_id and s.id=sid and s.active=true)
   then sid=null; end if;

 v_pass=(p_analysis->>'is_buyer_request'='true' and v_kind in ('buyer_request','marketplace_post')
   and v_intent>=3 and v_confidence>=0.75 and v_fit='exact' and sid is not null
   and v_likelihood in ('strong','moderate')
   and p_analysis->>'rejection_rule_triggered'='false'
   and v_eligibility <> 'mismatch');

 v_url=lower(regexp_replace(regexp_replace(c.source_url,'^https?://(www\.)?','','i'),'[?#].*$',''));
 v_url=regexp_replace(v_url,'/+$','');
 if c.source_platform='freelancer' and v_url ~ '^([a-z0-9-]+\.)*freelancer\.[a-z.]+/projects/'
    then v_fingerprint='freelancer.com/'||split_part(v_url,'/projects/',2);
    v_fingerprint='freelancer.com/projects/'||split_part(v_url,'/projects/',2);
 else v_fingerprint=v_url; end if;

 if v_pass then
   select id into existing_id from public.opportunities
    where workspace_id=p_workspace_id and (
      fingerprint=v_fingerprint or
      lower(regexp_replace(regexp_replace(coalesce(source_url,''),'^https?://(www\.)?','','i'),'[?#].*$',''))=v_url
    ) limit 1;
   if existing_id is not null then
     v_status='duplicate'; v_reason='Opportunity already exists in this workspace.';
   else
     -- Source evidence is MANUALLY ENTERED, not independently fetched.
     -- A capped preliminary score prevents automatic pitch recommendation.
     insert into public.opportunities(
       workspace_id,source,source_item_id,source_url,title,raw_text,requirement,
       matched_service_id,intent_level,preliminary_score,total_score,
       score_stage,status,recommended_action,fingerprint,
       research_status,research_summary,research_detail_reason,
       source_quality_score,source_quality_reason,source_result_type,buyer_likelihood,
       why_relevant,raw_payload
     ) values(
       p_workspace_id,'manual_capture',c.id::text,c.source_url,c.title,c.requirement,c.requirement,
       sid,v_intent,45,45,'preliminary','review','research',v_fingerprint,
       'partial','User-supplied description only. Linked source not fetched or independently verified.',
       'company_identity_unverified',
       0,'Manual description; source authenticity and freshness unverified.',v_kind,v_likelihood,
       'AI text triage: '||v_reason,
       jsonb_build_object('manual_capture_id',c.id,'source_platform',c.source_platform,
         'source_verified',false,'qualification_version','manual-v1',
         'score_cap_reason','No independent source verification','analysis',p_analysis)
     ) returning id into new_id;
     v_status='qualified';v_reason='AI triage passed. Requires manual source verification before outreach.';
   end if;
 else
   v_status='rejected';
   if v_fit<>'exact' or sid is null then v_reason='No exact active service match. '||v_reason; end if;
 end if;
 update public.manual_capture_reviews
   set status=v_status,qualification_finished_at=now(),qualification_reason=v_reason,
    qualification_result=p_analysis,qualified_opportunity_id=coalesce(new_id,existing_id),
    qualification_lease=null
 where id=c.id and workspace_id=p_workspace_id;
 return jsonb_build_object('status',v_status,'capture_id',c.id,'opportunity_id',coalesce(new_id,existing_id),
     'reason',v_reason,'source_verified',false);
end $$;
revoke all on function public.finish_manual_capture_qualification(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_manual_capture_qualification(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.fail_manual_capture_qualification(
 p_workspace_id uuid,p_capture_id uuid,p_lease uuid,p_reason text
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 update public.manual_capture_reviews
 set status='failed',qualification_finished_at=now(),
     qualification_reason=left(coalesce(p_reason,'Worker failed'),300),
     qualification_lease=null
 where workspace_id=p_workspace_id and id=p_capture_id
   and status='qualifying' and qualification_lease=p_lease;
 return found;
end $$;
revoke all on function public.fail_manual_capture_qualification(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_manual_capture_qualification(uuid,uuid,uuid,text) to service_role;