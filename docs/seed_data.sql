-- ArogyaSync — Supabase Mock Seed Data
-- Run this in the Supabase SQL editor to populate your empty tables with mock data for testing.
-- =============================================================================

-- 1. Seed the Secret Key (for PHC Registration)
INSERT INTO public.secret_key (key)
VALUES ('GOV_PASS_2026')
ON CONFLICT DO NOTHING;

-- 2. Seed a Mock PHC
INSERT INTO public.phcs (id, name, latitude, longitude, is_active)
VALUES ('PHC-MYS-01', 'Mysuru', 12.2958, 76.6394, true)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Mock Doctors
-- Generating random UUIDs for the doctors
INSERT INTO public.doctors (id, full_name, specialty, is_on_duty, phc_id)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Dr. Ramesh Kumar', 'General Physician', true, 'PHC-MYS-01'),
  ('22222222-2222-2222-2222-222222222222', 'Dr. Anita Sharma', 'Cardiologist', false, 'PHC-MYS-01')
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Mock Inventory
INSERT INTO public.inventory (item_name, quantity, unit, min_threshold)
VALUES 
  ('Paracetamol 500mg', 450, 'Tablets', 100),
  ('Amoxicillin 250mg', 120, 'Capsules', 50),
  ('Bandages', 300, 'Rolls', 50),
  ('Syringes (5ml)', 80, 'Units', 100);

-- 5. Seed Mock Patients
INSERT INTO public.patients (id, name, gender, blood_group, phone, allergies, critical_history)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 'Rahul Dravid', 'Male', 'O+', '9876543210', 'None', 'Hypertension'),
  ('44444444-4444-4444-4444-444444444444', 'Priya Patel', 'Female', 'A-', '9876543211', 'Penicillin', 'No significant history')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Mock Visits
INSERT INTO public.visits (patient_id, doctor_id, triage_status, status, chief_complaint, vitals)
VALUES 
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Yellow', 'Waiting', 'Severe headache and dizziness', '{"bp": "140/90", "spo2": "97", "temp": "98.6", "heartRate": "88"}'),
  ('44444444-4444-4444-4444-444444444444', null, 'Green', 'Completed', 'Routine checkup', '{"bp": "120/80", "spo2": "99", "temp": "98.4", "heartRate": "72"}');

-- NOTE: To fully test the app, you will also need user accounts in `auth.users`. 
-- The easiest way to generate those is to use the app itself (e.g. go to /register-phc to create an ASHA worker).
