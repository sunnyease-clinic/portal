alter table public.cloud_patients
  add column if not exists is_demo boolean not null default false;

update public.cloud_patients
set is_demo = true
where display_name = '示範病友';

create table if not exists public.portal_ip_attempts (
  ip_hash text primary key,
  failed_count integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.portal_ip_attempts enable row level security;
revoke all privileges on public.portal_ip_attempts from anon, authenticated;
grant all on public.portal_ip_attempts to service_role;

create index if not exists portal_ip_attempts_updated_at_idx
  on public.portal_ip_attempts (updated_at);
