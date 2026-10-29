alter table public.opportunities
  add column if not exists source_result_type text,
  add column if not exists source_quality_score numeric not null default 0,
  add column if not exists source_quality_reason text,
  add column if not exists buyer_likelihood text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_source_quality_score_check'
  ) then
    alter table public.opportunities
      add constraint opportunities_source_quality_score_check
      check (
        source_quality_score >= 0
        and source_quality_score <= 10
      );
  end if;
end
$$;
