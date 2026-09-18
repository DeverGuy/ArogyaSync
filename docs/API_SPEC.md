# API & Data Interface Specification

Since we are using Supabase, most database operations will occur directly via the Supabase Client (PostgREST). This document defines the logical data access patterns (Contracts) the agents must adhere to.

## 1. Queue Management & Triage (Visits Table)

**Fetch Active Queue:**
* Query: `visits` where `status = 'WAITING'`
* Order: By `triage_status` (RED > YELLOW > GREEN), then by `created_at` (Ascending).

**Update Triage:**
* Action: Update `visits` record.
* Payload: `{ triage_status: 'RED', asha_instructions: 'Severe chest pain' }`
* *Trigger:* Supabase Realtime will broadcast this change to the Doctor's dashboard.

## 2. Doctor Dashboard Data

**Fetch Next Patient:**
* Query: Same as "Fetch Active Queue", limit 1.

**Fetch Current Patient Details (Permanent Info):**
* Query: `patients` where `id = <patient_id>`
* Returns: Name, Blood Group, Gender, Phone, Emergency Phone.

**Fetch Previous Vitals:**
* Query: `visits` where `patient_id = <patient_id>` and `status = 'COMPLETED'`
* Order: By `visit_date` Descending, limit 1.
* Returns: Height, Weight, Age, Vitals.

**Update Current Vitals:**
* Action: Update `visits` record for the *current* visit.
* Payload: `{ height: ..., weight: ..., age_at_visit: ..., vitals_summary: ... }`

**Fetch Documents (X-Rays, Labs):**
* Query: `documents` where `patient_id = <patient_id>`

## 3. LoRa Simulation API (Middleware)
*(If implemented as a separate Node.js service)*

`POST /api/lora/transmit`
* Payload: `{ patient_id, triage_status, short_summary }`
* Behavior: Simulates a constrained transmission queue. Processes RED triage packets immediately, delays or queues others.

## 4. Offline Storage (IndexedDB/Dexie)
* The frontend MUST mirror the `patients` and `visits` schema locally.
* **Sync Strategy:** Writes go to IndexedDB first. If online, immediately sync to Supabase. If offline, queue in a local `sync_queue` table and replay when online.
