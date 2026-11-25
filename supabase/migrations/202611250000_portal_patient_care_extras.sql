-- Optional read-only care helpers on the patient portal: upcoming external
-- clinic appointments (next 90 days) and current chronic active medications.
alter table public.cloud_patients
  add column if not exists upcoming_appointments jsonb not null default '[]'::jsonb,
  add column if not exists active_medications jsonb not null default '[]'::jsonb;
