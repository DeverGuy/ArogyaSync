import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import {
  Radio, Send, ShieldAlert, CheckCircle2, Zap, SignalHigh,
  AlertTriangle, X, Clock, RefreshCw, Package
} from 'lucide-react';

/**
 * LoRa Transmission URL — configurable via env variable.
 * Default: localhost:5000 (Python Flask backend).
 */
const LORA_API_URL = import.meta.env.VITE_LORA_API_URL || 'http://localhost:5000';

/**
 * LoRaSelector — LoRa Transmission Control Panel
 *
 * Allows ASHA workers to:
 *   1. Review all 'Red' triage waiting patients eligible for LoRa transmission
 *   2. Review inventory items eligible for LoRa transmission
 *   3. Transmit selected records to the Python backend
 */
export function LoRaSelector() {
  // Only fetch Red triage Waiting visits
  const redVisits = useLiveQuery(() => db.visits.where('status').equals('Waiting').and(v => v.triage_status === 'Red').toArray(), []) || [];
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const inventory = useLiveQuery(() => db.inventory.toArray(), []) || [];

  const patientMap = patients.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

  const [selectedVisitIds, setSelectedVisitIds] = useState([]);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);
  const [transmitting, setTransmitting]         = useState(false);
  const [transmissionLog, setTransmissionLog]   = useState([]);
  const [backendStatus, setBackendStatus]       = useState('unknown'); 
  const [statusChecking, setStatusChecking]     = useState(false);

  const handleToggleVisit = (visitId) => {
    setSelectedVisitIds((prev) =>
      prev.includes(visitId) ? prev.filter((id) => id !== visitId) : [...prev, visitId]
    );
  };

  const handleToggleInventory = (itemId) => {
    setSelectedInventoryIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllRed = () => {
    setSelectedVisitIds(redVisits.map((v) => v.id));
  };
  
  const handleSelectAllInventory = () => {
    setSelectedInventoryIds(inventory.map((i) => i.id));
  };

  const handleCheckBackend = async () => {
    setStatusChecking(true);
    try {
      const res = await fetch(`${LORA_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
      setBackendStatus(res.ok ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    } finally {
      setStatusChecking(false);
    }
  };

  const buildPatientPacket = (visit) => {
    const patient = patientMap[visit.patient_id] || {};
    const v = visit.vitals || {};
    return {
      type:         'patient',
      patient_id:   visit.patient_id,
      visit_id:     visit.id,
      triage:       visit.triage_status,
      name:         patient.name     || 'Unknown',
      blood:        patient.blood_group || '?',
      allergy:      patient.allergies  || 'None',
      ePhone:       patient.emergency_phone || '',
      complaint:    visit.chief_complaint  || '',
      notes:        visit.survival_info    || '',
      bp:           v.bp        || '—',
      spo2:         v.spo2      || '—',
      hr:           v.heartRate || '—',
      temp:         v.temp      || '—',
      ts:           new Date().toISOString()
    };
  };

  const buildInventoryPacket = (item) => {
    // Retain 25% reserve locally, transmit 75% to gateway
    const loraQty = Math.floor(item.quantity * 0.75);
    return {
      type: 'inventory',
      id: item.id,
      name: item.item_name,
      qty: loraQty,
      ts: new Date().toISOString()
    };
  };

  const handleTransmit = async () => {
    if (selectedVisitIds.length === 0 && selectedInventoryIds.length === 0) {
      alert('Select at least one record to transmit.');
      return;
    }

    setTransmitting(true);
    setTransmissionLog([]);

    const selectedVisits = redVisits.filter((v) => selectedVisitIds.includes(v.id));
    const selectedInvItems = inventory.filter((i) => selectedInventoryIds.includes(i.id));

    let backendReachable = false;
    try {
      const healthRes = await fetch(`${LORA_API_URL}/health`, { signal: AbortSignal.timeout(2000) });
      backendReachable = healthRes.ok;
    } catch {
      backendReachable = false;
    }
    setBackendStatus(backendReachable ? 'online' : 'offline');

    const results = [];
    const allPackets = [
      ...selectedVisits.map(v => ({ packet: buildPatientPacket(v), title: patientMap[v.patient_id]?.name || 'Unknown', isRed: true })),
      ...selectedInvItems.map(i => ({ packet: buildInventoryPacket(i), title: i.item_name, isRed: false }))
    ];

    for (const item of allPackets) {
      const startTime = Date.now();
      const triageLabel = item.packet.type === 'patient' ? item.packet.triage : 'Inventory';
      const pId = item.packet.type === 'patient' ? item.packet.visit_id : item.packet.id;

      // Broadcast locally to simulate radio waves reaching the Doctor Dashboard UI in another tab
      const radioChannel = new BroadcastChannel('lora_radio');
      radioChannel.postMessage(item.packet);
      radioChannel.close();

      if (backendReachable) {
        try {
          const res = await fetch(`${LORA_API_URL}/api/lora/transmit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.packet),
            signal: AbortSignal.timeout(8000)
          });

          const data = await res.json();
          const elapsed = Date.now() - startTime;

          results.push({
            id:          pId,
            title:       item.title,
            triage:      triageLabel,
            byteSize:    data.compressed_size ?? '—',
            time:        new Date().toLocaleTimeString(),
            elapsed:     `${elapsed}ms`,
            status:      res.ok ? 'SUCCESS' : 'BACKEND_ERROR',
            channel:     data.channel ?? 'LoRa-868MHz',
            packetId:    data.packet_id ?? 'N/A',
            note:        data.message   ?? ''
          });
        } catch (err) {
          results.push({
            id: pId, title: item.title, triage: triageLabel, byteSize: '—',
            time: new Date().toLocaleTimeString(), elapsed: '—',
            status: 'REQUEST_FAILED', note: err.message
          });
        }
      } else {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
        const simPayload = JSON.stringify(item.packet);
        const byteSize = Math.min(new Blob([simPayload]).size, 256);

        results.push({
          id:          pId,
          title:       item.title,
          triage:      triageLabel,
          byteSize:    `~${byteSize}`,
          time:        new Date().toLocaleTimeString(),
          elapsed:     `${Math.round(600 + Math.random() * 400)}ms`,
          status:      'SIMULATED',
          channel:     'LoRa-868MHz (sim)',
          packetId:    `SIM-${pId.slice(0, 8)}`,
          note:        'Python backend unreachable — visual simulation only'
        });
      }
      setTransmissionLog([...results]);
    }

    setTransmitting(false);
    setSelectedVisitIds([]);
    setSelectedInventoryIds([]);
  };

  const statusColors = {
    SUCCESS:       { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#6ee7b7', label: '✅ TRANSMITTED' },
    SIMULATED:     { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#fde047', label: '📡 SIMULATED' },
    BACKEND_ERROR: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#fca5a5', label: '❌ BACKEND ERR' },
    REQUEST_FAILED:{ bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#fca5a5', label: '❌ FAILED' }
  };

  const totalSelected = selectedVisitIds.length + selectedInventoryIds.length;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px', borderLeft: '4px solid #06b6d4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Radio size={24} color="#06b6d4" />
              <h2 style={{ fontSize: '1.35rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
                LoRa Transmission Control
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
              Select Red Alert patients and Medicine Inventory to compress and broadcast over 15km LoRa RF network.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleCheckBackend} disabled={statusChecking}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)',
                background: 'rgba(15,23,42,0.6)', cursor: 'pointer', fontSize: '0.75rem',
                color: backendStatus === 'online' ? '#6ee7b7' : backendStatus === 'offline' ? '#fca5a5' : '#94a3b8'
              }}>
              {statusChecking ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <SignalHigh size={12} />}
              {backendStatus === 'online' ? 'Backend Online' : backendStatus === 'offline' ? 'Backend Offline' : 'Check Backend'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* ── Patient Selection (Red Only) ────────────────────────── */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} /> Red Alert Patients ({redVisits.length})
            </h3>
            <button onClick={handleSelectAllRed} className="btn" style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}>
              Select All
            </button>
          </div>

          {redVisits.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <CheckCircle2 size={24} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No Red Alert patients currently waiting.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {redVisits.map((visit) => {
                const patient = patientMap[visit.patient_id] || { name: 'Unknown' };
                const isSelected = selectedVisitIds.includes(visit.id);
                return (
                  <div key={visit.id} onClick={() => handleToggleVisit(visit.id)}
                    style={{
                      padding: '12px', cursor: 'pointer', borderRadius: '8px',
                      borderLeft: '4px solid #ef4444',
                      background: isSelected ? 'rgba(6,182,212,0.1)' : 'rgba(15,23,42,0.6)',
                      border: isSelected ? '1px solid rgba(6,182,212,0.5)' : '1px solid var(--border-color)',
                      borderLeftWidth: '4px',
                      display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                    <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#06b6d4', width: '16px', height: '16px' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>{patient.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Complaint: {visit.chief_complaint || 'N/A'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Inventory Selection ────────────────────────────────────── */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={16} /> Medicine Stock ({inventory.length})
            </h3>
            <button onClick={handleSelectAllInventory} className="btn" style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.4)', color: '#6ee7b7' }}>
              Select All
            </button>
          </div>

          {inventory.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <Package size={24} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No inventory items registered.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {inventory.map((item) => {
                const isSelected = selectedInventoryIds.includes(item.id);
                const loraQty = Math.floor(item.quantity * 0.75);
                return (
                  <div key={item.id} onClick={() => handleToggleInventory(item.id)}
                    style={{
                      padding: '12px', cursor: 'pointer', borderRadius: '8px',
                      borderLeft: '4px solid #10b981',
                      background: isSelected ? 'rgba(6,182,212,0.1)' : 'rgba(15,23,42,0.6)',
                      border: isSelected ? '1px solid rgba(6,182,212,0.5)' : '1px solid var(--border-color)',
                      borderLeftWidth: '4px',
                      display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                    <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#06b6d4', width: '16px', height: '16px' }} />
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>{item.item_name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '10px' }} title={`Total Stock: ${item.quantity}`}>
                        Tx Qty: {loraQty}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transmit Button */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={handleTransmit}
          className="btn btn-primary"
          disabled={transmitting || totalSelected === 0}
          style={{ flex: 1, padding: '14px', fontSize: '1rem', justifyContent: 'center', gap: '10px' }}
        >
          {transmitting ? (
            <><RefreshCw size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Transmitting…</>
          ) : (
            <><Send size={18} /> Transmit {totalSelected} Record{totalSelected !== 1 ? 's' : ''} via LoRa</>
          )}
        </button>
        {totalSelected > 0 && (
          <button onClick={() => { setSelectedVisitIds([]); setSelectedInventoryIds([]); }} className="btn btn-secondary" style={{ padding: '0 20px' }}>
            Clear Selection
          </button>
        )}
      </div>

      {/* ── Transmission Log ──────────────────────────────────────── */}
      {transmissionLog.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
            Transmission Log
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...transmissionLog].reverse().map((log, i) => {
              const style = statusColors[log.status] || statusColors.SIMULATED;
              return (
                <div key={i} className="glass-panel" style={{
                  padding: '14px', background: style.bg, border: `1px solid ${style.border}`, borderRadius: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>{log.title}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: style.text }}>{style.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.72rem', color: '#94a3b8' }}>
                    <span>Type: <strong style={{ color: '#e2e8f0' }}>{log.triage}</strong></span>
                    <span>Size: <strong style={{ color: '#e2e8f0' }}>{log.byteSize}B</strong></span>
                    <span>Channel: <strong style={{ color: '#e2e8f0' }}>{log.channel || '—'}</strong></span>
                    <span>Latency: <strong style={{ color: '#e2e8f0' }}>{log.elapsed}</strong></span>
                    {log.packetId && <span style={{ gridColumn: '1/-1' }}>Packet: <strong style={{ color: '#06b6d4', fontFamily: 'monospace' }}>{log.packetId}</strong></span>}
                  </div>
                  {log.note && (
                    <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', marginBottom: 0, fontStyle: 'italic' }}>
                      {log.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
