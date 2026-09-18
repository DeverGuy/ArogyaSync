import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Printer, CheckCircle, ShieldCheck, BookHeart, User, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

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
    if (!canvas) return;
    // Note: The original code expected this to be a canvas, but QRCodeSVG renders an svg.
    // Preserving the original code logic as requested.
    try {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      let downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${selectedPatient.name.replace(/\s+/g, '_')}_ArogyaSync_QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.warn("Could not download SVG as PNG using canvas.toDataURL");
    }
  };

  const handlePrintQR = () => {
    window.print();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-3xl mx-auto w-full text-[#111111]"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <QrCode className="w-6 h-6 text-[#111111]" />
        <div>
          <h2 className="text-xl text-[#111111] font-bold m-0 tracking-tight">
            Patient QR Identity Cards
          </h2>
          <p className="text-sm text-[#787774] m-0 mt-0.5">
            Generate offline-readable identity cards containing critical medical history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* ── Generator Panel ─────────────────────────────────────────── */}
        <motion.div 
          className="bg-white border border-[#EAEAEA] rounded-xl p-6"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <label className="block text-sm font-medium text-[#787774] mb-2">
            Select Patient to Generate QR
          </label>
          <select
            className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-4 py-3 text-[#111111] text-sm focus:outline-none focus:border-[#111111] transition-colors mb-8 appearance-none cursor-pointer"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
          >
            <option value="">-- Choose a patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — Phone: {p.phone} (Blood: {p.blood_group})
              </option>
            ))}
          </select>

          {selectedPatient && qrString && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-wrap gap-8 items-start"
            >
              {/* QR Code Graphic */}
              <div className="bg-white p-4 rounded-xl border border-[#EAEAEA] inline-flex flex-shrink-0">
                <QRCodeSVG
                  id="qr-canvas"
                  value={qrString}
                  size={200}
                  level="Q"
                  includeMargin={true}
                  imageSettings={{
                    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMTExMTExIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJ2MjAiPjwvcGF0aD48cGF0aCBkPSJNMjIgMTJoLTIwIj48L3BhdGg+PC9zdmc+',
                    x: undefined, y: undefined, height: 24, width: 24, excavate: true,
                  }}
                />
              </div>

              {/* Encoded Data Preview */}
              <div className="flex-1 min-w-[280px]">
                <h3 className="text-base text-[#111111] mb-5 flex items-center gap-2.5 font-medium">
                  <ShieldCheck className="w-5 h-5 text-[#111111]" /> 
                  Data Encoded in QR
                </h3>

                <div className="flex flex-col gap-3.5">
                  <div className="flex gap-3 items-center">
                     <User className="w-4 h-4 text-[#787774] flex-shrink-0" />
                     <span className="text-[#787774] text-sm w-20">Name:</span>
                     <strong className="text-[#111111] text-sm font-medium">{selectedPatient.name}</strong>
                  </div>
                  <div className="flex gap-3 items-center">
                     <div className="w-4 flex-shrink-0" />
                     <span className="text-[#787774] text-sm w-20">Blood:</span>
                     <strong className="text-[#111111] text-sm font-medium">{selectedPatient.blood_group}</strong>
                  </div>
                  <div className="flex gap-3 items-start">
                     <BookHeart className="w-4 h-4 text-[#787774] flex-shrink-0 mt-0.5" />
                     <span className="text-[#787774] text-sm w-20 flex-shrink-0">Allergies:</span>
                     <strong className="text-[#111111] text-sm font-medium leading-relaxed">{selectedPatient.allergies || 'None'}</strong>
                  </div>
                  <div className="flex gap-3 items-start">
                     <div className="w-4 flex-shrink-0" />
                     <span className="text-[#787774] text-sm w-20 flex-shrink-0">History:</span>
                     <strong className="text-[#111111] text-sm font-medium leading-relaxed">{selectedPatient.critical_history || 'None'}</strong>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <motion.button 
                    onClick={handleDownloadQR} 
                    className="flex-1 flex items-center justify-center gap-2 bg-[#111111] text-white py-2.5 px-4 rounded-md text-sm font-semibold hover:scale-95 transition-transform duration-200"
                  >
                    <Download className="w-4 h-4" /> Save PNG
                  </motion.button>
                  <motion.button 
                    onClick={handlePrintQR} 
                    className="flex-1 flex items-center justify-center gap-2 bg-[#111111] text-white py-2.5 px-4 rounded-md text-sm font-medium hover:scale-95 transition-transform duration-200"
                  >
                    <Printer className="w-4 h-4" /> Print Card
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {!selectedPatient && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="p-8 text-center border border-dashed border-[#EAEAEA] rounded-xl bg-[#F9F9F8]"
            >
              <CheckCircle className="w-8 h-8 text-[#787774] mx-auto mb-3" />
              <p className="text-[#787774] text-sm m-0">Select a patient above to generate their Smart Health QR code.</p>
            </motion.div>
          )}
        </motion.div>

      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-canvas, #qr-canvas * { visibility: visible; }
          #qr-canvas { position: absolute; left: 0; top: 0; width: 300px !important; height: 300px !important; }
        }
      `}</style>
    </motion.div>
  );
}
