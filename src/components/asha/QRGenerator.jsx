import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Printer, CheckCircle, ShieldCheck, BookHeart, User, HeartPulse } from 'lucide-react';

export function QRGenerator({ initialPatientId }) {
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const visits    = useLiveQuery(() => db.visits.toArray(), []) || [];

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');

  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    } else if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [initialPatientId, patients]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const latestVisit = visits
    .filter((v) => v.patient_id === selectedPatientId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Construct compressed JSON payload for QR code
  // Includes allergies and critical history for offline-readable emergency info
  const qrPayloadObj = selectedPatient ? {
    pid:     selectedPatient.id,
    name:    selectedPatient.name,
    gender:  selectedPatient.gender,
    blood:   selectedPatient.blood_group,
    ePhone:  selectedPatient.emergency_phone,
    allergy: selectedPatient.allergies || 'None known',
    hx:      selectedPatient.critical_history || 'None',
    hash:    selectedPatient.qr_hash,
    triage:  latestVisit?.triage_status ?? 'Green',
    vitals:  latestVisit?.vitals ?? { bp: '120/80', spo2: '98%' }
  } : null;

  const qrString = qrPayloadObj ? JSON.stringify(qrPayloadObj) : '';

  const handleDownloadQR = () => {
    if (!selectedPatient) return;
    const canvas = document.getElementById('qr-canvas');
    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    let downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `${selectedPatient.name.replace(/\s+/g, '_')}_ArogyaSync_QR.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handlePrintQR = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <QrCode size={24} color="#06b6d4" />
        <div>
          <h2 style={{ fontSize: '1.35rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
            Patient QR Identity Cards
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
            Generate offline-readable identity cards containing critical medical history.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* ── Generator Panel ─────────────────────────────────────────── */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            Select Patient to Generate QR
          </label>
          <select
            className="input-field"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ marginBottom: '24px' }}
          >
            <option value="">-- Choose a patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.blood_group} · {p.phone}
              </option>
            ))}
          </select>

          {selectedPatient && qrString && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
              
              {/* QR Code Graphic */}
              <div style={{
                background: '#fff', padding: '16px', borderRadius: '16px',
                display: 'inline-block', boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                border: '4px solid #f1f5f9'
              }}>
                <QRCodeSVG
                  id="qr-canvas"
                  value={qrString}
                  size={200}
                  level="Q"
                  includeMargin={true}
                  imageSettings={{
                    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMGI5NGEwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJ2MjAiPjwvcGF0aD48cGF0aCBkPSJNMjIgMTJoLTIwIj48L3BhdGg+PC9zdmc+',
                    x: undefined, y: undefined, height: 24, width: 24, excavate: true,
                  }}
                />
              </div>

              {/* Encoded Data Preview */}
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h3 style={{ fontSize: '1rem', color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#10b981" /> Data Encoded in QR
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                     <User size={16} color="#94a3b8" />
                     <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Name:</span>
                     <strong style={{ color: '#f8fafc' }}>{selectedPatient.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                     <div style={{ width: 16 }} />
                     <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Blood Group:</span>
                     <strong style={{ color: '#ef4444' }}>{selectedPatient.blood_group}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                     <BookHeart size={16} color="#94a3b8" style={{ marginTop: '2px' }} />
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Allergies:</span>
                       <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{selectedPatient.allergies || 'None'}</strong>
                     </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                     <div style={{ width: 16 }} />
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>History:</span>
                       <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{selectedPatient.critical_history || 'None'}</strong>
                     </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button onClick={handleDownloadQR} className="btn btn-primary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem', justifyContent: 'center' }}>
                    <Download size={16} /> Save PNG
                  </button>
                  <button onClick={handlePrintQR} className="btn btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem', justifyContent: 'center' }}>
                    <Printer size={16} /> Print Card
                  </button>
                </div>
              </div>
            </div>
          )}

          {!selectedPatient && (
            <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              <CheckCircle size={32} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a patient above to generate their Smart Health QR code.</p>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-canvas, #qr-canvas * { visibility: visible; }
          #qr-canvas { position: absolute; left: 0; top: 0; width: 300px !important; height: 300px !important; }
        }
      `}</style>
    </div>
  );
}
