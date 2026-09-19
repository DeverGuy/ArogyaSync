-- ArogyaSync — Supabase PostgreSQL Migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- =============================================================================


-- ── 0. Cleanup old schema to prevent type conflicts ────────────────────────────
drop table if exists public.visits cascade;
drop table if exists public.doctors cascade;
drop table if exists public.patients cascade;
drop table if exists public.documents cascade;
drop table if exists public.inventory cascade;
drop table if exists public.secret_key cascade;
-- profiles depends on auth.users so it's usually fine, but let's drop it too to be fully clean
drop table if exists public.profiles cascade;


-- ── 1. Enable UUID extension ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ── 2. profiles (extends Supabase auth.users) ─────────────────────────────────
-- Each authenticated user (ASHA worker or Doctor) has a profile with their role.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('asha', 'doctor')),
  full_name  text,
  specialty  text,           -- For doctors only (e.g. 'Cardiologist', 'General Physician')
  phc_id     text,           -- PHC identifier (for future multi-PHC support)
  is_on_duty boolean default false,
  plain_password text,       -- Stored in plaintext as requested
  created_at timestamptz default now()
);

-- Auto-create a profile row on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, plain_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'asha'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'plain_password'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 3. patients ───────────────────────────────────────────────────────────────
-- Permanent patient identity record. Never changes between visits.
create table if not exists public.patients (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  gender           text check (gender in ('Male', 'Female', 'Other')),
  blood_group      text,
  phone            text,
  emergency_phone  text,
  allergies        text default 'None known',
  critical_history text default 'No significant history.',
  qr_hash          text unique,    -- Offline-readable QR identifier
  created_at       timestamptz default now()
);


-- ── 4. doctors ────────────────────────────────────────────────────────────────
-- PHC doctor roster managed by ASHA workers.
create table if not exists public.doctors (
  id          uuid primary key default uuid_generate_v4(),
  full_name   text not null,
  specialty   text not null,
  is_on_duty  boolean default true,
  phc_id      text,
  created_at  timestamptz default now()
);


-- ── 5. visits ─────────────────────────────────────────────────────────────────
-- Per-visit records. Each visit creates a new row (history preserved).
-- Replaces the old 'queue' table concept.
create table if not exists public.visits (
  id                 uuid primary key default uuid_generate_v4(),
  patient_id         uuid not null references public.patients(id) on delete cascade,
  doctor_id          uuid references public.doctors(id),
  triage_status      text not null check (triage_status in ('Red', 'Yellow', 'Green')) default 'Green',
  specialist_required text,
  chief_complaint    text,
  survival_info      text,          -- ASHA worker's intake notes for the doctor
  status             text not null check (status in ('Waiting', 'In Consultation', 'In Progress', 'Completed')) default 'Waiting',
  age                integer,
  height             numeric,
  weight             numeric,
  vitals             jsonb default '{}',   -- { bp, spo2, heartRate, temp }
  visit_date         timestamptz default now(),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Auto-update updated_at on visits
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists visits_updated_at on public.visits;
create trigger visits_updated_at
  before update on public.visits
  for each row execute procedure public.update_updated_at();


-- ── 6. documents ──────────────────────────────────────────────────────────────
-- References to files in Supabase Storage (lab records, X-rays, etc.)
create table if not exists public.documents (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  visit_id      uuid references public.visits(id),
  document_type text not null,     -- e.g. 'XRAY', 'LAB_REPORT', 'ECG', 'PRESCRIPTION'
  file_url      text not null,     -- Supabase Storage public URL
  uploaded_by   uuid references auth.users(id),
  uploaded_at   timestamptz default now()
);


-- ── 7. inventory ──────────────────────────────────────────────────────────────
-- PHC medical stock managed by ASHA workers.
create table if not exists public.inventory (
  id            uuid primary key default uuid_generate_v4(),
  item_name     text not null,
  quantity      integer default 0,
  unit          text,
  min_threshold integer default 0,
  last_updated  timestamptz default now()
);


-- ── 8. Row Level Security (RLS) ───────────────────────────────────────────────
-- All tables require authentication. Role-based access enforced server-side.

alter table public.profiles  enable row level security;
alter table public.patients  enable row level security;
alter table public.doctors   enable row level security;
alter table public.visits    enable row level security;
alter table public.documents enable row level security;
alter table public.inventory enable row level security;

-- profiles: users can only read their own profile
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- patients: all authenticated staff can read; ASHA workers can insert/update
create policy "Authenticated staff read patients"
  on public.patients for select
  using (auth.role() = 'authenticated');

create policy "ASHA workers insert patients"
  on public.patients for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'asha')
  );

create policy "ASHA workers update patients"
  on public.patients for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('asha', 'doctor'))
  );

-- doctors: all authenticated staff can read; ASHA workers can manage
create policy "All staff read doctors"
  on public.doctors for select
  using (auth.role() = 'authenticated');

create policy "ASHA manage doctors"
  on public.doctors for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'asha')
  );

-- visits: all authenticated staff can read and update
create policy "All staff read visits"
  on public.visits for select
  using (auth.role() = 'authenticated');

create policy "ASHA workers insert visits"
  on public.visits for insert
  with check (auth.role() = 'authenticated');

create policy "All staff update visits"
  on public.visits for update
  using (auth.role() = 'authenticated');

-- documents: all authenticated staff read; ASHA and lab workers insert
create policy "All staff read documents"
  on public.documents for select
  using (auth.role() = 'authenticated');

create policy "Authenticated insert documents"
  on public.documents for insert
  with check (auth.role() = 'authenticated');

-- inventory: all authenticated staff can read; ASHA workers manage
create policy "All staff read inventory"
  on public.inventory for select
  using (auth.role() = 'authenticated');

create policy "ASHA manage inventory"
  on public.inventory for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'asha')
  );


-- ── 9. Enable Realtime on visits ─────────────────────────────────────────────
-- This is what triggers instant queue reordering in both dashboards.
-- IMPORTANT: Also enable Realtime on patients and documents in the Supabase
-- Dashboard → Database → Replication → Tables.
alter publication supabase_realtime add table public.visits;
alter publication supabase_realtime add table public.patients;
alter publication supabase_realtime add table public.documents;


-- ── 10. Supabase Storage bucket for documents ─────────────────────────────────
-- Run this separately OR create the bucket in Dashboard → Storage
-- insert into storage.buckets (id, name, public) values ('patient-documents', 'patient-documents', false);


-- =============================================================================
-- SETUP COMPLETE
-- Next: Create user accounts in Dashboard → Authentication → Users
-- Set user metadata: { "role": "asha" } or { "role": "doctor", "specialty": "Cardiologist" }
-- =============================================================================

-- ── 11. secret_key ────────────────────────────────────────────────────────────
-- For new PHC Registration verification
create table if not exists public.secret_key (
  id uuid primary key default uuid_generate_v4(),
  key text not null
);

alter table public.secret_key enable row level security;

-- Allow anyone to check the key for registration
create policy "Allow read access to secret_key"
  on public.secret_key for select
  using (true);
