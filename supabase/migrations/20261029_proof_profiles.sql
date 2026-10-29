alter table public.portfolio_items
  add column if not exists proof_type text not null default 'project',
  add column if not exists platform text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.portfolio_items'::regclass
      and conname = 'portfolio_items_proof_type_check'
  ) then
    alter table public.portfolio_items
      add constraint portfolio_items_proof_type_check
      check (
        proof_type in (
          'project',
          'profile',
          'case_study',
          'publication',
          'testimonial',
          'certification',
          'other'
        )
      );
  end if;
end
$$;
