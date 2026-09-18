"""
ArogyaSync — Python LoRa Middleware Backend
============================================

Simulates the LoRa (Low-Power Wide-Area Network) transmission layer:
  - Receives patient triage payloads from the React frontend
  - Compresses data into ultra-light 256-byte micro-strings
  - Encrypts with AES-256-GCM
  - Simulates priority queueing (Red → Yellow → Green)
  - Returns transmission metadata (compressed size, packet ID, channel)

Endpoints:
  GET  /health             — Backend health check
  POST /api/lora/transmit  — Transmit a single patient record via LoRa
  GET  /api/lora/queue     — View current transmission queue status

Run:
  pip install -r requirements.txt
  python app.py

Environment variables (optional):
  LORA_PORT     — HTTP port (default: 5000)
  AES_SECRET    — 32-byte AES key (auto-generated if not set)
"""

import os
import json
import uuid
import time
import struct
import hashlib
import threading
import logging
from datetime import datetime, timezone
from collections import deque
from base64 import b64encode

from flask import Flask, request, jsonify
from flask_cors import CORS
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ── Configuration ──────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s %(message)s')
logger = logging.getLogger('ArogyaSync-LoRa')

PORT = int(os.environ.get('LORA_PORT', 5000))

# AES-256 key: 32 bytes from env, or auto-generated for dev sessions
_raw_key = os.environ.get('AES_SECRET', '')
AES_KEY  = (_raw_key.encode()[:32].ljust(32, b'\x00')
            if _raw_key else os.urandom(32))

LORA_MAX_BYTES     = 256       # LoRa payload constraint
LORA_CHANNEL       = 'LoRa-868MHz'   # EU ISM band simulation
LORA_RANGE_KM      = 15
LORA_BAUDRATE_BPS  = 5400      # Typical LoRa SF9/BW125

# Priority queue (thread-safe)
_tx_queue  = deque()
_queue_lock = threading.Lock()
_tx_log    = []   # Transmission history (in-memory, session only)

# ── Flask App ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, origins=['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'])


# ── Compression & Encryption ───────────────────────────────────────────────────

def compress_payload(data: dict) -> bytes:
    """
    Compresses a payload into a compact binary micro-string.
    Handles both 'patient' and 'inventory' types.
    """
    payload_type = data.get('type', 'patient')

    if payload_type == 'inventory':
        micro = {
            'T': 0x00, # 0x00 signifies Inventory
            'IN': (data.get('name', '') or '')[:30],
            'Q': data.get('qty', 0),
            'ts': int(time.time())
        }
        return json.dumps(micro, separators=(',', ':')).encode('utf-8')[:LORA_MAX_BYTES]

    # Otherwise treat as patient triage
    triage_code = {'Red': 0x01, 'Yellow': 0x02, 'Green': 0x03}.get(data.get('triage', 'Green'), 0x03)

    micro = {
        'T': triage_code,
        'N': (data.get('name', '') or '')[:20],
        'B': data.get('blood', 'O+'),
        'A': (data.get('allergy', '') or '')[:30],
        'C': (data.get('complaint', '') or '')[:30],
        'V': {
            'bp':  data.get('bp', ''),
            's':   data.get('spo2', ''),
            'hr':  data.get('hr', ''),
            't':   data.get('temp', '')
        },
        'P': data.get('patient_id', '')[:8],
        'E': (data.get('ePhone', '') or '')[:12],
        'ts': int(time.time())
    }

    payload_bytes = json.dumps(micro, separators=(',', ':')).encode('utf-8')

    if len(payload_bytes) > LORA_MAX_BYTES:
        micro['C'] = micro['C'][:15]
        micro['A'] = micro['A'][:15]
        payload_bytes = json.dumps(micro, separators=(',', ':')).encode('utf-8')

    if len(payload_bytes) > LORA_MAX_BYTES:
        micro.pop('A', None)
        payload_bytes = json.dumps(micro, separators=(',', ':')).encode('utf-8')

    return payload_bytes[:LORA_MAX_BYTES]


def encrypt_aes256(plaintext: bytes) -> dict:
    """
    Encrypts `plaintext` using AES-256-GCM.
    Returns base64-encoded ciphertext + nonce for transmission.
    """
    aesgcm = AESGCM(AES_KEY)
    nonce  = os.urandom(12)   # 96-bit nonce per GCM spec
    ct     = aesgcm.encrypt(nonce, plaintext, None)
    return {
        'ciphertext': b64encode(ct).decode(),
        'nonce':      b64encode(nonce).decode(),
        'algo':       'AES-256-GCM'
    }


def simulate_lora_transmission(packet_bytes: bytes, triage: str) -> dict:
    """
    Simulates the physical LoRa transmission:
      - Red triage: immediate (0ms simulated delay)
      - Yellow:     short delay (200ms)
      - Green:      normal delay (500ms)
      - Inventory:  lowest priority (800ms)
    Returns transmission metadata.
    """
    delays = {'Red': 0, 'Yellow': 0.2, 'Green': 0.5, 'Inventory': 0.8}
    delay  = delays.get(triage, 0.5)
    time.sleep(delay)

    byte_count = len(packet_bytes)
    tx_time_ms = round((byte_count * 8 / LORA_BAUDRATE_BPS) * 1000, 1)

    return {
        'transmitted_bytes': byte_count,
        'tx_time_ms':        tx_time_ms,
        'channel':           LORA_CHANNEL,
        'range_km':          LORA_RANGE_KM,
        'priority_delay_ms': round(delay * 1000)
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get('/health')
def health():
    return jsonify({
        'status': 'online',
        'service': 'ArogyaSync LoRa Middleware',
        'version': '1.0.0',
        'queue_depth': len(_tx_queue),
        'channel': LORA_CHANNEL,
        'range_km': LORA_RANGE_KM
    })


@app.post('/api/lora/transmit')
def transmit():
    """
    Transmit a patient triage or inventory record over the simulated LoRa network.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON payload'}), 400

    payload_type = data.get('type', 'patient')
    triage       = data.get('triage', 'Green') if payload_type == 'patient' else 'Inventory'
    packet_id    = f"LORA-{uuid.uuid4().hex[:12].upper()}"
    record_id    = data.get('patient_id') or data.get('id', '?')
    
    logger.info(f"[TX] Received {triage} packet for record {record_id[:8]}")

    try:
        # 1. Compress to micro-string
        compressed = compress_payload(data)
        compressed_size = len(compressed)
        logger.info(f"[TX] Compressed: {compressed_size} bytes (limit: {LORA_MAX_BYTES}B)")

        # 2. Encrypt with AES-256-GCM
        encrypted = encrypt_aes256(compressed)

        # 3. Simulate LoRa physical transmission (priority-ordered delay)
        tx_meta = simulate_lora_transmission(compressed, triage)

        # 4. Log to in-memory session log
        log_entry = {
            'packet_id':       packet_id,
            'patient_id':      data.get('patient_id', '?'),
            'visit_id':        data.get('visit_id', '?'),
            'triage':          triage,
            'patient_name':    data.get('name', 'Unknown'),
            'compressed_size': compressed_size,
            'encrypted_size':  len(b64encode(encrypted['ciphertext'].encode())),
            'channel':         tx_meta['channel'],
            'tx_time_ms':      tx_meta['tx_time_ms'],
            'timestamp':       datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'status':          'TRANSMITTED'
        }
        _tx_log.append(log_entry)

        return jsonify({
            'success':         True,
            'packet_id':       packet_id,
            'message':         f'{triage} priority packet transmitted successfully over {LORA_CHANNEL}',
            'compressed_size': compressed_size,
            'channel':         tx_meta['channel'],
            'range_km':        tx_meta['range_km'],
            'tx_time_ms':      tx_meta['tx_time_ms'],
            'priority_delay_ms': tx_meta['priority_delay_ms'],
            'encryption':      {'algo': encrypted['algo']},
            'timestamp':       log_entry['timestamp']
        })

    except Exception as e:
        logger.error(f"[TX] Transmission failed: {e}", exc_info=True)
        return jsonify({'error': f'Transmission failed: {str(e)}'}), 500


@app.get('/api/lora/queue')
def get_queue():
    """Return recent transmission log entries (last 50)."""
    return jsonify({
        'log':        list(reversed(_tx_log[-50:])),
        'total_sent': len(_tx_log)
    })


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    logger.info(f"ArogyaSync LoRa Middleware starting on port {PORT}")
    logger.info(f"Channel: {LORA_CHANNEL} | Range: {LORA_RANGE_KM}km | Max packet: {LORA_MAX_BYTES}B")
    logger.info(f"AES-256 key: {'from env' if os.environ.get('AES_SECRET') else 'auto-generated (dev mode)'}")
    app.run(host='0.0.0.0', port=PORT, debug=True)
