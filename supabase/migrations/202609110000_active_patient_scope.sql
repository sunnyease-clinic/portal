-- Keep historical patient data but deny normal Portal access after the clinic
-- marks a patient as no longer active. portal_sync.py reconciles this flag.
alter table public.cloud_patients
  add column if not exists is_active boolean not null default true;

create index if not exists cloud_patients_active_cloud_id_idx
  on public.cloud_patients (cloud_id)
  where is_active = true;
