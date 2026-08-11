-- All patient-facing reads now pass through the trusted BFF.
drop policy if exists "Allow anon read cloud_shares" on public.cloud_shares;

revoke all privileges on public.cloud_patients from anon, authenticated;
revoke all privileges on public.cloud_clinical_rules from anon, authenticated;
revoke all privileges on public.cloud_access_logs from anon, authenticated;
revoke all privileges on public.cloud_shares from anon, authenticated;

create table if not exists public.portal_auth_attempts (
  identifier_hash text not null,
  ip_hash text not null,
  failed_count integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (identifier_hash, ip_hash)
);

alter table public.portal_auth_attempts enable row level security;
revoke all privileges on public.portal_auth_attempts from anon, authenticated;
grant all on public.portal_auth_attempts to service_role;

create index if not exists portal_auth_attempts_updated_at_idx
  on public.portal_auth_attempts (updated_at);
