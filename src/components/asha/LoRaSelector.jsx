import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Radio, Send, ShieldAlert, CheckCircle2, Zap, SignalHigh } from 'lucide-react';

export function LoRaSelector() {
  const queueEntries = useLiveQuery(() => db.queue.where('status').equals('Waiting').toArray(), []) || [];
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];

  const patientMap = patients.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [transmitting, setTransmitting] = useState(false);
  const [transmissionLog, setTransmissionLog] = useState([]);

  const redEntries = queueEntries.filter((q) => q.triage_status === 'Red');

  const handleToggleSelect = (queueId) => {
    setSelectedQueueIds((prev) =>
      prev.includes(queueId) ? prev.filter((id) => id !== queueId) : [...prev, queueId]
    );
  };

  const handleSelectAllRed = () => {
    const redIds = redEntries.map((q) => q.id);
    setSelectedQueueIds(redIds);
  };

  const handleSimulateLoRaTransmit = () => {
    if (selectedQueueIds.length === 0) {
      alert('Select at least one patient record to transmit over LoRa simulation.');
      return;
    }

    setTransmitting(true);
    setTransmissionLog([]);

    const selectedEntries = queueEntries.filter((q) => selectedQueueIds.includes(q.id));

    let delay = 500;
    selectedEntries.forEach((qEntry, idx) => {
      const patient = patientMap[qEntry.patient_id] || { name: 'Patient', blood_group: 'O+' };
      const vitals = qEntry.vitals || {};

      // Calculate packet payload byte size
      const packetPayload = JSON.stringify({
        t: qEntry.triage_status,
        name: patient.name,
        blood: patient.blood_group,
        bp: vitals.bp,
        spo2: vitals.spo2,
        notes: qEntry.survival_info
      });
      const byteSize = new Blob([packetPayload]).size;

      setTimeout(() => {
        setTransmissionLog((prev) => [
          ...prev,
          {
            id: qEntry.id,
            patientName: patient.name,
            triage: qEntry.triage_status,
            size: byteSize,
            time: new Date().toLocaleTimeString(),
            status: 'TRANSMITTED_SUCCESS'
          }
        ]);

        if (idx === selectedEntries.length - 1) {
          setTransmitting(false);
        }
      }, delay);

      delay += 900;
    });
  };

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto' }}>
      
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={24} color="#f59e0b" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                LoRa Priority Dead-Zone Packet Transmitter
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                Simulate low-bandwidth long-range packet broadcasting for emergency cases in internet blackouts.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSelectAllRed}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', borderColor: 'var(--triage-red-border)', color: '#fca5a5' }}
            >
              <ShieldAlert size={14} color="#ef4444" />
              <span>Auto-Select Emergency RED ({redEntries.length})</span>
            </button>

            <button
              onClick={handleSimulateLoRaTransmit}
              disabled={transmitting || selectedQueueIds.length === 0}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              <Send size={15} />
              <span>{transmitting ? 'Transmitting Over LoRa...' : `Transmit ${selectedQueueIds.length} Packets`}</span>
            </button>
          </div>

        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Left: Queue Selector */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SignalHigh size={16} />
            <span>1. Select Patient Packets for LoRa Broadcast</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queueEntries.map((qEntry) => {
              const patient = patientMap[qEntry.patient_id] || { name: 'Patient' };
              const isSelected = selectedQueueIds.includes(qEntry.id);
              const isRed = qEntry.triage_status === 'Red';
              const isYellow = qEntry.triage_status === 'Yellow';

              return (
                <div
                  key={qEntry.id}
                  onClick={() => handleToggleSelect(qEntry.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(13, 148, 136, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                        {patient.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Queue ID: {qEntry.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${isRed ? 'badge-red' : isYellow ? 'badge-yellow' : 'badge-green'}`}>
                    {qEntry.triage_status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Simulation Transmission Log Console */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#10b981', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={16} />
            <span>2. LoRa Network Broadcast Simulation Console</span>
          </h3>

          <div style={{
            background: '#090d16',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            minHeight: '260px',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: '#a7f3d0',
            overflowY: 'auto'
          }}>
            {transmissionLog.length === 0 ? (
              <span style={{ color: 'var(--text-dim)' }}>
                [READY] Waiting for LoRa transmission trigger... Select packets on the left and click "Transmit".
              </span>
            ) : (
              transmissionLog.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px dashed rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                  <div style={{ color: '#38bdf8' }}>[{log.time}] BROADCASTING LORA PACKET #{idx + 1}</div>
                  <div>Patient: <strong style={{ color: '#fff' }}>{log.patientName}</strong> ({log.triage} Triage)</div>
                  <div>Payload Size: <strong style={{ color: '#fde047' }}>{log.size} bytes</strong> (Compressed)</div>
                  <div style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <CheckCircle2 size={12} />
                    <span>Transmitted to Doctor Node successfully!</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
