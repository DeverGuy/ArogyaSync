# Product Requirements Document (PRD)

## Product Overview
**Product Name:** ArogyaSync
**Problem:** Accessibility and quality of public healthcare in rural/underserved areas, characterized by connectivity isolation, lack of real-time patient data, and inefficient queue management.
**Solution:** An offline-first, cross-platform web application featuring smart queue management, offline patient data access via QR codes, and simulated LoRa transmission for dead-zone bridging.
**Target Users:** ASHA Workers / PHC Staff, Doctors.
**Core Value Proposition:** Ensuring uninterrupted healthcare delivery and real-time clinical synchronization regardless of internet connectivity.

## Problem Analysis
1. **Connectivity isolation:** Rural PHCs often lose internet.
2. **Patient-data accessibility:** Doctors lack medical history (vitals, lab reports) when offline.
3. **Queue management:** Inefficient prioritization of emergency (Red triage) patients.
4. **Data Synchronization:** Delays in updating patient records across the network.

## User Personas
1. **ASHA Worker (PHC Worker):** Manages the intake, triage, QR generation, inventory, and transmission.
2. **Doctor:** Conducts consultations, reviews past records, updates vitals, and relies on an automated smart queue.

## Feature List

### ASHA Worker Dashboard (PHC)
1. **Smart Queue Management:** View and manage the patient appointment queue.
2. **Digital Triage:** Assign Red, Yellow, or Green status to patients. Add important instructions for the doctor.
3. **Queue Reordering:** Queue automatically reorders based on Triage severity.
4. **QR Generation Window:** Generate QR codes containing basic offline-retrievable patient data.
5. **LoRa Transmission Selection:** Select priority data (based on triage) to transmit via the simulated LoRa network.
6. **Stock/Inventory Upload:** Manage PHC stock.

### Doctor Dashboard
1. **Next Patient Sidebar:** Real-time view of the next patient in the queue on the right side of the screen.
2. **Current Patient View (Main Screen):**
   - **Header:** Patient Name, Blood Group, Gender, Phone Number, Emergency Phone (Permanent info).
   - **Vitals Section:** Display previous visit vitals (Height, Weight, Age, Vitals) fetched from Supabase.
   - **Vitals Update:** Ability to update the current vitals.
   - **Documentation Section:** View previous lab records and X-rays.

### System-Wide Features
1. **Real-time Sync:** ASHA and Doctor dashboards must stay perfectly in sync without page reloads (via Supabase Realtime).
2. **Offline Mode:** Basic patient data retrieval and queueing must work offline.
3. **LoRa Simulation:** Simulate the transmission of critical triage data over a constrained network.

## Non-Functional Requirements
* **Cross-Platform:** Must run in modern web browsers (Web/PWA).
* **Real-time:** Zero-delay sync between dashboards.
* **Offline-capable:** Must handle network drops gracefully.
