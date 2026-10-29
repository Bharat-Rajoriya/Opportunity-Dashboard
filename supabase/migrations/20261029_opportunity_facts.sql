alter table public.opportunities
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists project_type text,
  add column if not exists duration_text text,
  add column if not exists workload_text text,
  add column if not exists experience_level text,
  add column if not exists location_text text,
  add column if not exists remote_status text,
  add column if not exists skills text[] not null default '{}';
