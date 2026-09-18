# Database Documentation (Supabase PostgreSQL)

## Entities & Tables

### 1. `patients`
Stores permanent patient information.
* `id` (UUID, Primary Key)
* `full_name` (Text)
* `gender` (Text)
* `blood_group` (Text)
* `phone_number` (Text)
* `emergency_phone` (Text)
* `qr_hash` (Text, Unique) - Represents the data encoded in the QR.
* `created_at` (Timestamp)

### 2. `visits`
Stores individual visit data, vitals, and triage status.
* `id` (UUID, Primary Key)
* `patient_id` (UUID, Foreign Key -> patients.id)
* `visit_date` (Timestamp)
* `age_at_visit` (Integer)
* `height` (Numeric)
* `weight` (Numeric)
* `vitals_summary` (Text/JSONB)
* `triage_status` (Enum: 'RED', 'YELLOW', 'GREEN')
* `asha_instructions` (Text)
* `status` (Enum: 'WAITING', 'IN_CONSULTATION', 'COMPLETED')
* `created_at` (Timestamp)
* `updated_at` (Timestamp)

### 3. `documents`
Stores references to lab records, X-Rays, etc.
* `id` (UUID, Primary Key)
* `patient_id` (UUID, Foreign Key -> patients.id)
* `visit_id` (UUID, Foreign Key -> visits.id, Nullable)
* `document_type` (Text - e.g., 'XRAY', 'LAB_REPORT')
* `file_url` (Text - Supabase Storage URL)
* `uploaded_at` (Timestamp)

### 4. `inventory` (Draft)
* `id` (UUID, Primary Key)
* `item_name` (Text)
* `quantity` (Integer)
* `last_updated` (Timestamp)

## Supabase Row Level Security (RLS)
* **Authentication:** Users (ASHA workers, Doctors) must be authenticated via Supabase Auth.
* **RLS Policies:**
  * `patients`: Read-only for all authenticated staff. Insert/Update for ASHA workers.
  * `visits`: Select/Insert/Update for all authenticated staff.
  * `documents`: Read-only for Doctors. Insert for ASHA/Lab workers.

## Realtime Configuration
* The `visits` table MUST have Realtime enabled in Supabase to trigger instant queue updates on both dashboards when `status` or `triage_status` changes.
