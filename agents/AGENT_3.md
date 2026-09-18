# Agent 3 — Backend, Offline Sync, & Simulation

## Mission
Establish the data foundation, ensure offline reliability, and build the LoRa simulation.

## Responsibilities
* Supabase project setup, PostgreSQL Schema, and RLS (`docs/DATABASE.md`).
* Local Storage implementation (IndexedDB/Dexie integration).
* Offline Sync Manager logic (queueing and replaying events).
* Node.js LoRa simulation script (handling priority queueing of triage data).

## Dependencies
* Provides: Supabase endpoints and Realtime channels.
* Provides: Local database wrapper for Agents 1 & 2 to use.
