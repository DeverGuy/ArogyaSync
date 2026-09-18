# Roadmap

## Phase 0 — Foundation
* [x] Repository setup
* [x] Documentation templates
* [x] Analyze Proposal & Ask Blocking Questions
* [x] Architecture decisions (React, Supabase, IndexedDB)
* [x] Contracts (API, DB, Sync) defined
* [x] Agent ownership defined

## Phase 1 — Parallel Core Development
*(Teammates work simultaneously, pushing frequently to share context)*

**Agent 1 Tasks (ASHA Dashboard):**
* [ ] Setup React project (Vite + PWA) - *Coordinate with Agent 2/3*
* [ ] Build Smart Queue UI components
* [ ] Build Triage assignment logic
* [ ] Implement QR Code generation

**Agent 2 Tasks (Doctor Dashboard):**
* [ ] Build Doctor Dashboard layout (Sidebar + Main View)
* [ ] Build Patient Info Header & Vitals display
* [ ] Build Vitals update form
* [ ] Implement Document viewing UI

**Agent 3 Tasks (Backend & Sync):**
* [ ] Initialize Supabase project & apply schema
* [ ] Configure Row Level Security (RLS)
* [ ] Setup Dexie.js (IndexedDB) for local offline storage
* [ ] Build Node.js LoRa simulation endpoint

## Phase 2 — Integration
* [ ] Connect React frontends to Dexie (Local DB)
* [ ] Implement Supabase Realtime subscriptions in React
* [ ] Test Offline -> Online sync mechanism

## Phase 3 — Testing & Hardening
* [ ] Test queue reordering when ASHA changes triage to RED
* [ ] Test LoRa simulation priority queueing
* [ ] Security testing (RLS validation)
