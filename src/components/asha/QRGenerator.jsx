import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Printer, CheckCircle, ShieldCheck, Search, Scan } from 'lucide-react';

export function QRGenerator({ initialPatientId }) {
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const queueEntries = useLiveQuery(() => db.queue.toArray(), []) || [];

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [scannedPayloadInput, setScannedPayloadInput] = useState('');
  const [decodedData, setDecodedData] = useState(null);

  useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    } else if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [initialPatientId, patients]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const latestQueueEntry = queueEntries
    .filter((q) => q.patient_id === selectedPatientId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // Construct compressed JSON payload for QR code
  const qrPayloadObj = selectedPatient ? {
    pid: selectedPatient.id,
    name: selectedPatient.name,
    gender: selectedPatient.gender,
    blood: selectedPatient.blood_group,
    ePhone: selectedPatient.emergency_phone,
    hash: selectedPatient.qr_hash,
    triage: latestQueueEntry ? latestQueueEntry.triage_status : 'Green',
    vitals: latestQueueEntry?.vitals ?? { bp: '120/80', spo2: '98%' }
  } : null;

  const qrString = qrPayloadObj ? JSON.stringify(qrPayloadObj) : '';

  const handleSimulateScan = () => {
    try {
      if (!scannedPayloadInput.trim()) {
        if (qrString) {
          setDecodedData(qrPayloadObj);
          return;
        }
        alert('Please paste a QR code payload JSON');
        return;
      }
      const parsed = JSON.parse(scannedPayloadInput);
      setDecodedData(parsed);
    } catch (err) {
      alert('Invalid QR payload JSON format');
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: QR Generator & Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <QrCode size={24} color="#06b6d4" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Offline Patient Health QR Generator
            </h2>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Select Patient for QR Generation
            </label>
            <select
              className="input-field"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.gender}, Blood: {p.blood_group})
                </option>
              ))}
            </select>
          </div>

          {selectedPatient && qrPayloadObj ? (
            <div>
              {/* Patient Printable Health ID Card */}
              <div 
                id="printable-qr-card"
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '1px solid rgba(13, 148, 136, 0.4)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  marginBottom: '20px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                      ArogyaSync PHC Health Pass
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: '#06b6d4', margin: 0 }}>Offline Retrieval Token</p>
                  </div>
                  <span className={`badge ${qrPayloadObj.triage === 'RED' ? 'badge-red' : qrPayloadObj.triage === 'YELLOW' ? 'badge-yellow' : 'badge-green'}`}>
                    {qrPayloadObj.triage} TRIAGE
                  </span>
                </div>

                {/* Card Body: Info & QR SVG */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                  
                  {/* QR SVG Container */}
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <QRCodeSVG 
                      value={qrString} 
                      size={140} 
                      level="M" 
                      includeMargin={false}
                    />
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                      {selectedPatient.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '2px' }}>
                      Gender: <strong style={{ color: '#e2e8f0' }}>{selectedPatient.gender}</strong> | Blood: <strong style={{ color: '#06b6d4' }}>{selectedPatient.blood_group}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '2px' }}>
                      Emergency Contact: <strong style={{ color: '#e2e8f0' }}>{selectedPatient.emergency_phone}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontFamily: 'monospace' }}>
                      Hash: {selectedPatient.qr_hash}
                    </div>
                  </div>

                </div>

                {/* Vitals Summary Footer */}
                {latestVisit && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>BP: <strong style={{ color: '#38bdf8' }}>{qrPayloadObj.vitals.bp}</strong></span>
                    <span>SpO2: <strong style={{ color: '#4ade80' }}>{qrPayloadObj.vitals.spo2}</strong></span>
                    <span>Pulse: <strong style={{ color: '#facc15' }}>{qrPayloadObj.vitals.heartRate}</strong></span>
                    <span>Temp: <strong style={{ color: '#f87171' }}>{qrPayloadObj.vitals.temp}</strong></span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handlePrintCard}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <Printer size={16} />
                  <span>Print Health Card</span>
                </button>
              </div>

            </div>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>Select a patient to preview QR Code.</p>
          )}

        </div>

        {/* Right Column: QR Reader / Scanner Tester */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Scan size={24} color="#10b981" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Offline QR Verification Scanner
            </h2>
          </div>

          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '16px' }}>
            Simulate offline reading by scanning or testing payload decoding without requiring internet connectivity.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              QR Code Raw Payload JSON
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Paste scanned JSON string here or click 'Verify Current QR' below..."
              value={scannedPayloadInput}
              onChange={(e) => setScannedPayloadInput(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handleSimulateScan}
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.85rem' }}
            >
              <ShieldCheck size={16} color="#10b981" />
              <span>Verify & Decode QR Payload</span>
            </button>
          </div>

          {/* Decoded Result View */}
          {decodedData && (
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6ee7b7', fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem' }}>
                <CheckCircle size={18} color="#10b981" />
                <span>Offline Verification Successful!</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: '#e2e8f0' }}>
                <div>Patient Name: <strong>{decodedData.name}</strong></div>
                <div>Triage Status: <strong style={{ color: decodedData.triage === 'RED' ? '#fca5a5' : '#fde047' }}>{decodedData.triage}</strong></div>
                <div>Blood Group: <strong>{decodedData.blood}</strong></div>
                <div>Emergency Contact: <strong>{decodedData.ePhone}</strong></div>
              </div>

              {decodedData.vitals && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Extracted Vitals: BP <strong>{decodedData.vitals.bp}</strong>, SpO2 <strong>{decodedData.vitals.spo2}</strong>, Pulse <strong>{decodedData.vitals.heartRate}</strong>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
