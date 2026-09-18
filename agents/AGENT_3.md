# Agent 3 — Offline / Sync / Integration

## Mission
Bridge the gap between offline operations and the cloud backend securely and reliably, handling hardware abstractions and data queuing.

## Responsibilities
* Local SQLite storage
* Offline event queue
* Synchronization logic
* Middleware
* LoRa/Bluetooth adapters (or simulations)
* Integration testing

## Owned Directories
*TBD - Awaiting Architecture Decisions*

## Dependencies
* Consumes: Database Schema, Event Schemas, API Contract

## Definition of Done
* Offline-first operations successfully queue.
* Sync logic recovers gracefully from failures.
* Tests (including simulated hardware failures) pass.
* Interfaces clearly documented.
