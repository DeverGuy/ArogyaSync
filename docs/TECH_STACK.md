# Technology Stack

## Frontend: React.js (Vite + PWA)
**Why we selected it:** The platform needs to be a cross-platform website with offline capabilities. React is ideal for building dynamic dashboards (ASHA & Doctor) and managing real-time state.
**What problem it solves:** Provides a component-based architecture for the complex dashboards and handles real-time UI updates seamlessly.
**Alternatives considered:** Flutter (rejected as the requirement is specifically a website, and Flutter Web can be heavy).

## Backend: Supabase (PostgreSQL)
**Why we selected it:** Provides out-of-the-box PostgreSQL, Authentication, Storage (for X-Rays/Lab records), and crucial **Realtime capabilities**.
**What problem it solves:** The requirement states that the ASHA and Doctor dashboards must be in real-time sync (e.g., triage updates instantly reorder the queue). Supabase Realtime solves this elegantly.

## Local Database: IndexedDB (via Dexie.js) or SQLite WASM
**Why we selected it:** Browsers cannot run native SQLite directly. To achieve "offline-first" in a web browser, IndexedDB is the native solution. We can wrap it with Dexie.js for easier querying, or use SQLite WASM if a strict SQL interface is preferred.
**What problem it solves:** Allows the application to work offline, storing queues, patient data, and triage statuses until connectivity is restored.

## Middleware / LoRa Simulation: Node.js (or Python)
**Why we selected it:** We are building a software simulation of LoRa transmission. A simple Node.js or Python backend script can simulate packet loss, bandwidth constraints, and priority-based queuing (Red triage first).
**What problem it solves:** Proves the concept of dead-zone bridging without requiring physical hardware for the initial MVP.

## Synchronization & Real-time: Supabase Realtime
**Why we selected it:** Natively integrates with our PostgreSQL database to broadcast database changes (like queue updates and triage changes) instantly to all connected clients.
