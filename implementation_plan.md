# Implement LoRa MAC Protocols & Emergency Override

The goal is to update the LoRa transmission logic to support two advanced MAC protocols, replacing the legacy 20-minute scheduled breaks, and implement an emergency override mechanism.

## Proposed Changes

We will implement both **Listen Before Talk (CSMA/CA)** and **Micro-Time Slicing (TDMA)** in the Python middleware backend. We will also add a UI toggle to the React frontend so you can demonstrate either protocol on the fly.

### Backend (`backend/app.py`)
1. **Global Channel State:** Introduce a `_channel_state` tracking when the channel is busy and who is transmitting.
2. **MAC Protocol Simulation:**
   - **CSMA/CA:** Nodes check if the channel is busy before transmitting. If busy, they wait a random backoff (2-5 seconds) and retry.
   - **TDMA:** Nodes are hashed to a specific 5-second time slot within a 25-second cycle. They must wait for their designated slot to transmit.
3. **Emergency Override:** If a packet's triage status is **Red (Critical)**, it immediately bypasses the CSMA/CA wait or TDMA slot wait, overriding the channel and transmitting instantly.
4. **Endpoint Update:** The `/api/lora/transmit` endpoint will accept an `X-MAC-Protocol` header to determine which simulation logic to run.

### Frontend (`src/components/asha/LoRaSelector.jsx`)
1. **Protocol Toggle:** Add a dropdown next to the "Check Backend" button to select between `CSMA/CA` and `TDMA`.
2. **Transmission Request:** Send the selected protocol via the `X-MAC-Protocol` header.
3. **Timeout Increase:** Increase the transmission timeout from 8 seconds to 45 seconds to accommodate the potential TDMA slot waits or CSMA/CA backoff retries.

## Open Questions

- By default, the simulation uses CSMA/CA. Is that acceptable as the default state?
- For TDMA, we assign the time slot based on a hash of the `sender_phc` identifier. Does this align with your expectations for the 5-node setup?

## Verification Plan

### Automated/Manual Verification
- Select multiple patients, including one with a "Red" triage status.
- Initiate transmission with CSMA/CA and observe that the Red packet completes immediately, while others may incur a backoff delay if the channel is busy.
- Switch to TDMA and transmit. Observe that packets wait for their scheduled 5-second slot (latency will vary up to 25s), while a Red triage packet bypasses the wait.
