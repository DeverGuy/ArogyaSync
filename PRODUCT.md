# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary users are **ASHA (Accredited Social Health Activists)** and **PHC (Primary Health Center) Doctors** operating in rural healthcare settings, often with intermittent or zero internet connectivity.

## Product Purpose
An offline-first patient intake, triage, and consultation system. It enables ASHA workers to digitally register patients, generate QR codes, record vitals, and queue them for doctors, while allowing doctors to conduct consultations seamlessly. Success means zero data loss during offline periods and seamless syncing when connectivity is restored.

## Positioning
ArogyaSync uniquely combines **local-first browser storage (IndexedDB/Dexie)** with hardware **LoRa radio transmissions** for emergency signaling, ensuring healthcare workflows never halt due to network outages. It bridges the gap between remote villages and cloud infrastructure (Supabase).

## Operating Context
- **Hardware**: Low-end tablets or smartphones for ASHA workers; desktop/laptops for Doctors. LoRa gateway receivers for emergency broadcasts.
- **Environment**: High-stress clinics, offline rural areas.
- **Workflows**: Patient registration -> Vitals/Triage (Red/Yellow/Green) -> LoRa emergency broadcast (if critical) -> Doctor Queue -> Consultation & Records.

## Capabilities and Constraints
- Must function 100% offline using `navigator.onLine` checks and Dexie.
- Must sync payloads to Supabase automatically when online.
- Uses LoRa on 868.0 MHz for critical packet transmission.
- Strict requirement: Underlying Dexie and Supabase sync logic must NEVER be broken by UI updates.

## Evidence on Hand
- Working IndexedDB implementations.
- Active offline sync queues.
- LoRa BroadcastChannel simulators.

## Product Principles
1. **Unbreakable Reliability**: The interface must communicate offline state and sync status with absolute clarity.
2. **Speed Under Pressure**: Triage and vital entry must be fast, high-contrast, and distraction-free.
3. **Data Security**: Medical records are sensitive; UI must reflect a trusted, clinical, and secure environment without feeling sterile.
