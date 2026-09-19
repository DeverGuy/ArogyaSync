import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import {
  Radio, Send, ShieldAlert, CheckCircle2, Zap, SignalHigh,
  AlertTriangle, X, Clock, RefreshCw, Package
} from 'lucide-react';
import { motion } from 'motion/react';

const LORA_API_URL = import.meta.env.VITE_LORA_API_URL || 'http://localhost:5000';

export function LoRaSelector() {
  const allVisits = useLiveQuery(() => db.visits.toArray(), []) || [];
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const inventory = useLiveQuery(() => db.inventory.toArray(), []) || [];

  const patientMap = patients.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

  const [selectedVisitIds, setSelectedVisitIds] = useState([]);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);
  const [transmitting, setTransmitting] = useState(false);
  const [transmissionLog, setTransmissionLog] = useState(() => {
    const saved = localStorage.getItem('asha_lora_logs');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      const fiveDaysAgo = Date.now() - 432000000;
      return parsed.filter(log => log.timestamp && log.timestamp > fiveDaysAgo);
    } catch {
      return [];
    }
  });
  const [backendStatus, setBackendStatus] = useState('unknown'); 
  const [statusChecking, setStatusChecking] = useState(false);

  useEffect(() => {
    localStorage.setItem('asha_lora_logs', JSON.stringify(transmissionLog));
  }, [transmissionLog]);

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

  const handleSelectAllPatients = () => {
    setSelectedVisitIds(allVisits.map((v) => v.id));
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
      id:           visit.id,
      sender_phc:   localStorage.getItem('current_phc') || 'unknown',
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
    const loraQty = Math.floor(item.quantity * 0.75);
    return {
      type: 'inventory',
      sender_phc: localStorage.getItem('current_phc') || 'unknown',
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

    const selectedVisits = allVisits.filter((v) => selectedVisitIds.includes(v.id));
    const selectedInvItems = inventory.filter((i) => selectedInventoryIds.includes(i.id));

    let backendReachable = false;
    try {
      const healthRes = await fetch(`${LORA_API_URL}/health`, { signal: AbortSignal.timeout(2000) });
      backendReachable = healthRes.ok;
    } catch {
      backendReachable = false;
    }
    setBackendStatus(backendReachable ? 'online' : 'offline');

    const allPackets = [
      ...selectedVisits.map(v => ({ packet: buildPatientPacket(v), title: patientMap[v.patient_id]?.name || 'Unknown', isRed: v.triage_status === 'Red' })),
      ...selectedInvItems.map(i => ({ packet: buildInventoryPacket(i), title: i.item_name, isRed: false }))
    ];

    for (const item of allPackets) {
      const startTime = Date.now();
      const triageLabel = item.packet.type === 'patient' ? item.packet.triage : 'Inventory';
      const pId = item.packet.type === 'patient' ? item.packet.visit_id : item.packet.id;

      const radioChannel = new BroadcastChannel('lora_radio');
      radioChannel.postMessage(item.packet);
      radioChannel.close();

      let newLogItem = null;

      if (backendReachable) {
        try {
          const res = await fetch(`${LORA_API_URL}/api/lora/transmit`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(item.packet),
            signal: AbortSignal.timeout(45000)
          });

          const data = await res.json();
          const elapsed = Date.now() - startTime;

          newLogItem = {
            id:          pId,
            title:       item.title,
            triage:      triageLabel,
            byteSize:    data.compressed_size ?? '—',
            time:        new Date().toLocaleTimeString(),
            timestamp:   Date.now(),
            elapsed:     `${elapsed}ms`,
            status:      res.ok ? 'SUCCESS' : 'BACKEND_ERROR',
            channel:     data.channel ?? 'LoRa-868MHz',
            packetId:    data.packet_id ?? 'N/A',
            note:        data.message   ?? ''
          };
        } catch (err) {
          newLogItem = {
            id: pId, title: item.title, triage: triageLabel, byteSize: '—',
            time: new Date().toLocaleTimeString(), timestamp: Date.now(), elapsed: '—',
            status: 'REQUEST_FAILED', note: err.message
          };
        }
      } else {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
        const simPayload = JSON.stringify(item.packet);
        const byteSize = Math.min(new Blob([simPayload]).size, 256);

        newLogItem = {
          id:          pId,
          title:       item.title,
          triage:      triageLabel,
          byteSize:    `~${byteSize}`,
          time:        new Date().toLocaleTimeString(),
          timestamp:   Date.now(),
          elapsed:     `${Math.round(600 + Math.random() * 400)}ms`,
          status:      'SIMULATED',
          channel:     'LoRa-868MHz (sim)',
          packetId:    `SIM-${pId.slice(0, 8)}`,
          note:        'Python backend unreachable — visual simulation only'
        };
      }
      
      setTransmissionLog(prev => [...prev, newLogItem]);
    }

    setTransmitting(false);
    setSelectedVisitIds([]);
    setSelectedInventoryIds([]);
  };

  const statusStyles = {
    SUCCESS:       { badgeBg: 'bg-[#EDF3EC]', badgeText: 'text-[#346538]', label: 'TRANSMITTED' },
    SIMULATED:     { badgeBg: 'bg-[#FBF3DB]', badgeText: 'text-[#956400]', label: 'SIMULATED' },
    BACKEND_ERROR: { badgeBg: 'bg-[#FDEBEC]', badgeText: 'text-[#9F2F2D]', label: 'BACKEND ERR' },
    REQUEST_FAILED:{ badgeBg: 'bg-[#FDEBEC]', badgeText: 'text-[#9F2F2D]', label: 'FAILED' }
  };

  const totalSelected = selectedVisitIds.length + selectedInventoryIds.length;

  const animationProps = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <div className="max-w-4xl mx-auto font-sans text-[#111111]">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <motion.div 
        {...animationProps}
        className="bg-white border border-[#EAEAEA] p-8 mb-8 rounded-xl flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Radio size={24} className="text-[#111111]" />
            <h2 className="text-xl font-bold m-0 text-[#111111]">
              LoRa Transmission Control
            </h2>
          </div>
          <p className="text-sm text-[#787774] m-0">
            Select patient records and Medicine Inventory to compress and broadcast over 15km LoRa RF network.
            <br />
            <span className="text-xs italic">(Uses CSMA / Listen Before Talk to prevent network collisions)</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handleCheckBackend} 
            disabled={statusChecking}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-transform cursor-pointer ${
              backendStatus === 'online' ? 'bg-[#EDF3EC] border-transparent text-[#346538]' : 
              backendStatus === 'offline' ? 'bg-[#FDEBEC] border-transparent text-[#9F2F2D]' : 
              'bg-[#F9F9F8] border-[#EAEAEA] text-[#111111] hover:scale-95'
            }`}
          >
            {statusChecking ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <SignalHigh size={14} />
            )}
            {statusChecking 
              ? 'Checking...' 
              : backendStatus === 'online' 
                ? 'Backend Online' 
                : backendStatus === 'offline' 
                  ? 'Backend Offline (Simulating)' 
                  : 'Check Backend'}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        
        {/* ── Patient Selection (All Patients) ────────────────────────── */}
        <motion.div 
          {...animationProps} transition={{ ...animationProps.transition, delay: 0.1 }}
          className="bg-white border border-[#EAEAEA] p-6 rounded-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider m-0 flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#111111]" /> All Patients ({allVisits.length})
            </h3>
            <button 
              onClick={handleSelectAllPatients} 
              className="text-xs px-3 py-1.5 bg-[#F9F9F8] border border-[#EAEAEA] text-[#111111] rounded-md cursor-pointer hover:bg-[#EAEAEA] transition-colors"
            >
              Select All
            </button>
          </div>

          {allVisits.length === 0 ? (
            <div className="p-8 text-center bg-[#F9F9F8] border border-[#EAEAEA] rounded-xl">
              <CheckCircle2 size={24} className="text-[#787774] mb-3 mx-auto" />
              <p className="text-[#787774] text-sm m-0">No patient records available.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
              {allVisits.map((visit) => {
                const patient = patientMap[visit.patient_id] || { name: 'Unknown' };
                const isSelected = selectedVisitIds.includes(visit.id);
                return (
                  <motion.div 
                    whileHover={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    whileTap={{ scale: 0.99 }}
                    key={visit.id} 
                    onClick={() => handleToggleVisit(visit.id)}
                    className={`p-4 cursor-pointer rounded-xl border flex items-center gap-4 transition-colors ${
                      isSelected 
                        ? 'bg-[#F9F9F8] border-[#111111]' 
                        : 'bg-white border-[#EAEAEA]'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      readOnly 
                      className="accent-[#111111] w-4 h-4 cursor-pointer" 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#111111] text-sm">{patient.name}</div>
                      <div className="text-xs text-[#787774] mt-1">Complaint: {visit.chief_complaint || 'N/A'}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Inventory Selection ────────────────────────────────────── */}
        <motion.div 
          {...animationProps} transition={{ ...animationProps.transition, delay: 0.15 }}
          className="bg-white border border-[#EAEAEA] p-6 rounded-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider m-0 flex items-center gap-2">
              <Package size={16} className="text-[#111111]" /> Medicine Stock ({inventory.length})
            </h3>
            <button 
              onClick={handleSelectAllInventory} 
              className="text-xs px-3 py-1.5 bg-[#F9F9F8] border border-[#EAEAEA] text-[#111111] rounded-md cursor-pointer hover:bg-[#EAEAEA] transition-colors"
            >
              Select All
            </button>
          </div>

          {inventory.length === 0 ? (
            <div className="p-8 text-center bg-[#F9F9F8] border border-[#EAEAEA] rounded-xl">
              <Package size={24} className="text-[#787774] mb-3 mx-auto" />
              <p className="text-[#787774] text-sm m-0">No inventory items registered.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
              {inventory.map((item) => {
                const isSelected = selectedInventoryIds.includes(item.id);
                const loraQty = Math.floor(item.quantity * 0.75);
                return (
                  <motion.div 
                    whileHover={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    whileTap={{ scale: 0.99 }}
                    key={item.id} 
                    onClick={() => handleToggleInventory(item.id)}
                    className={`p-4 cursor-pointer rounded-xl border flex items-center gap-4 transition-colors ${
                      isSelected 
                        ? 'bg-[#F9F9F8] border-[#111111]' 
                        : 'bg-white border-[#EAEAEA]'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      readOnly 
                      className="accent-[#111111] w-4 h-4 cursor-pointer" 
                    />
                    <div className="min-w-0 flex-1 flex justify-between items-center">
                      <span className="font-semibold text-[#111111] text-sm">{item.item_name}</span>
                      <span 
                        className="text-[10px] uppercase tracking-wide font-bold bg-[#EAEAEA] text-[#787774] px-2 py-1 rounded-full" 
                        title={`Total Stock: ${item.quantity}`}
                      >
                        Tx Qty: {loraQty}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Transmit Button */}
      <motion.div 
        {...animationProps} transition={{ ...animationProps.transition, delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-4 mb-12"
      >
        <button
          onClick={handleTransmit}
          disabled={transmitting || totalSelected === 0}
          className={`flex-1 p-4 text-base flex justify-center items-center gap-3 rounded-md font-medium transition-transform ${
            transmitting || totalSelected === 0 
              ? 'bg-[#F9F9F8] text-[#787774] border border-[#EAEAEA] cursor-not-allowed' 
              : 'bg-[#111111] text-white cursor-pointer hover:scale-95'
          }`}
        >
          {transmitting ? (
            <><RefreshCw size={18} className="animate-spin" /> Transmitting…</>
          ) : (
            <><Send size={18} /> Transmit {totalSelected} Record{totalSelected !== 1 ? 's' : ''} via LoRa</>
          )}
        </button>
        {totalSelected > 0 && (
          <button 
            onClick={() => { setSelectedVisitIds([]); setSelectedInventoryIds([]); }} 
            className="px-6 py-4 rounded-md bg-white border border-[#EAEAEA] text-[#111111] hover:scale-95 transition-transform cursor-pointer font-medium"
          >
            Clear Selection
          </button>
        )}
      </motion.div>

      {/* ── Transmission Log ──────────────────────────────────────── */}
      {transmissionLog.length > 0 && (
        <motion.div 
          {...animationProps} transition={{ ...animationProps.transition, delay: 0.3 }}
        >
          <h3 className="text-xs font-bold text-[#787774] uppercase tracking-widest mb-4 m-0">
            Transmission Log
          </h3>
          <div className="flex flex-col gap-4">
            {[...transmissionLog].reverse().map((log, i) => {
              const style = statusStyles[log.status] || statusStyles.SIMULATED;
              return (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  key={i} 
                  className="p-5 border border-[#EAEAEA] rounded-xl bg-white"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-bold text-[#111111] text-sm">{log.title}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                      {style.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 text-xs text-[#787774]">
                    <span>Type: <strong className="text-[#111111] font-medium">{log.triage}</strong></span>
                    <span>Size: <strong className="text-[#111111] font-medium">{log.byteSize}B</strong></span>
                    <span>Channel: <strong className="text-[#111111] font-medium">{log.channel || '—'}</strong></span>
                    <span>Latency: <strong className="text-[#111111] font-medium">{log.elapsed}</strong></span>
                    {log.packetId && (
                      <span className="col-span-2 sm:col-span-4 mt-2">
                        Packet: <strong className="text-[#111111] font-mono font-medium">{log.packetId}</strong>
                      </span>
                    )}
                  </div>
                  {log.note && (
                    <p className="text-xs text-[#787774] mt-3 mb-0 italic">
                      {log.note}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
