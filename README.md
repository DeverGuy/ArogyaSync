# ArogyaSync 🩺

**SIH26133 — Accessibility and quality of public healthcare services, particularly in rural and underserved areas**

## Overview
**ArogyaSync** is an offline-first, cross-platform healthcare management system designed specifically for rural and underserved Public Health Centres (PHCs). It bridges the gap between connectivity isolation and critical patient care through smart queue management, offline data accessibility, and simulated LoRa network transmissions for dead-zone bridging.

---

## The Problem
Rural healthcare workers face severe challenges:
1. **Connectivity Isolation:** PHCs often operate in network dead zones, losing access to critical medical history.
2. **Inefficient Triage & Queueing:** Manual queues fail to properly prioritize emergency patients.
3. **Delayed Synchronization:** Doctors and ASHA workers suffer from out-of-sync information regarding patient vitals, documentation, and queue status.

## The Solution
ArogyaSync solves this by providing:
* **Real-time Dual Dashboards:** Instant, zero-delay synchronization between the ASHA Worker (PHC) and Doctor dashboards.
* **Smart Queue Management:** Automated queue sorting based on Digital Triage (Red, Yellow, Green). 
* **Offline-First Resilience:** Local offline storage allowing continuous operation, QR code generation, and patient data access even when the internet is down.
* **Dead-zone Bridging:** A LoRa simulation protocol for transmitting priority triage packets over constrained networks.

---

## Technology Stack
* **Frontend:** React.js (Vite + PWA)
* **Backend & Auth:** Supabase (PostgreSQL)
* **Real-time Sync:** Supabase Realtime
* **Local Offline Storage:** IndexedDB (via Dexie.js)
* **Middleware Simulation:** Node.js (LoRa simulation)

---

## Repository Structure
```text
/
├── docs/           # Architecture, API specs, DB schema, and PRD
├── agents/         # AI Agent responsibilities for the 3-developer team
├── rules.md        # Strict engineering and security rules
└── README.md       # Project overview
```
*(Application source code will be added as Phase 1 Development begins)*

---

## Development Workflow

### ⚠️ The Golden Rule for AI Context Sharing
Because 3 teammates are using 3 different AI agents on different devices, **your AI only knows what is on your local machine.** 

Before you start a new task, or before you ask your AI to write new code, you **MUST** run this command to get the latest context from your team:

```bash
git pull origin main && npm install
```
*(If you are using a different branch name, replace `main` with your branch name).*

Once you finish a task, always commit and push so your teammates can pull your updated context.

---

## Agent Ownership
To avoid merge conflicts, the team is split into specific domains. See the `/agents` directory for detailed boundaries:
* **Agent 1:** ASHA Worker Dashboard (Smart Queue, Triage, QR Generation)
* **Agent 2:** Doctor Dashboard (Queue Monitor, Patient Vitals, Documentation)
* **Agent 3:** Backend, Offline Sync Manager, & LoRa Simulation

---

## ⚠️ Important Security Warnings
* **NEVER** commit real patient data.
* **NEVER** commit secrets, API keys, or `.env` files.
* **NEVER** expose Supabase service-role credentials to the frontend.
* **ALWAYS** use synthetic data for development.