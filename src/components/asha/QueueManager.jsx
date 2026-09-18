import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import {
  Users, AlertTriangle, CheckCircle, ShieldAlert,
  ChevronRight, QrCode, Filter, Edit, X, Save, Stethoscope, Clock,
  Upload, FileUp, FileText, User, Activity, Trash2
} from 'lucide-react';
import { TriageForm } from './TriageForm';
import { motion, AnimatePresence } from 'motion/react';

// Triage sort priority: Red > Yellow > Green
const TRIAGE_PRIORITY = { Red: 1, Yellow: 2, Green: 3 };

// Helper to generate a fallback UUID for offline document uploads if crypto.randomUUID isn't available
const generateUUID = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

/**
 * QueueManager — Smart Queue View for ASHA Dashboard
 *
 * Shows all active (non-completed) patient visits, sorted by triage priority.
 * ASHA workers can:
 *   - View patient details, vitals, and ASHA notes
 *   - Update triage level inline (elevate to Red/Yellow)
 *   - Send patient to doctor ("In Consultation" status)
 *   - Generate QR for the patient
 *   - Edit any patient or visit detail via modal
 *   - Upload lab documents / X-Rays via modal
 *   - Register new patient via modal
 */
export function QueueManager({ onSelectQR }) {
  const [filterTriage, setFilterTriage] = useState('ALL');
  
  // Edit Details Modal State
  const [editingVisit, setEditingVisit] = useState(null);
  const [editData, setEditData] = useState({});

  // Document Upload Modal State
  const [docType, setDocType] = useState('LAB_REPORT');
  const [docFile, setDocFile] = useState(null);
  const [docUploading, setDocUploading] = useState(false);
  
  // Modal state for Patient Intake
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  // Live data from Dexie - ASHA sees Waiting and In Consultation patients
  const visits = useLiveQuery(() => {
    if (!db.visits) return [];
    return db.visits.toArray().then(arr => arr.filter(v => ['Waiting', 'In Consultation'].includes(v.status))).catch(() => []);
  }, []) || [];
  const patients = useLiveQuery(() => db.patients ? db.patients.toArray().catch(()=>[]) : [], []) || [];
  const doctors  = useLiveQuery(() => db.doctors ? db.doctors.toArray().catch(()=>[]) : [], []) || [];
  const documents = useLiveQuery(() => db.documents ? db.documents.toArray().catch(()=>[]) : [], []) || [];

  // Check if any doctor is currently busy (In Progress or In Consultation)
  const isDoctorBusy = useLiveQuery(() => {
    if (!db.visits) return false;
    return db.visits.toArray().then(arr => arr.some(v => ['In Progress', 'In Consultation'].includes(v.status))).catch(() => false);
  }, []) || false;

  const patientMap = patients.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  const doctorMap  = doctors.reduce((acc, d) => { acc[d.id] = d; return acc; }, {});

  // Sort: Red > Yellow > Green, then FIFO
  const sortedVisits = [...visits].sort((a, b) => {
    const pA = TRIAGE_PRIORITY[a.triage_status] ?? 4;
    const pB = TRIAGE_PRIORITY[b.triage_status] ?? 4;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const filtered = sortedVisits.filter((v) =>
    filterTriage === 'ALL' || v.triage_status === filterTriage
  );

  // Stats
  const countRed        = visits.filter((v) => v.triage_status === 'Red' && v.status === 'Waiting').length;
  const countYellow     = visits.filter((v) => v.triage_status === 'Yellow' && v.status === 'Waiting').length;
  const countGreen      = visits.filter((v) => v.triage_status === 'Green' && v.status === 'Waiting').length;
  const countConsulting = visits.filter((v) => v.status === 'In Consultation' || v.status === 'In Progress').length;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleSendToDoctor = async (visitId) => {
    const now = new Date().toISOString();
    const payload = { id: visitId, status: 'In Consultation', updated_at: now };
    await db.visits.update(visitId, payload);
    await enqueueOfflineAction('visits', 'UPDATE', payload);
  };

  const handleElevateTriage = async (visitId, newTriage) => {
    const now = new Date().toISOString();
    const payload = { id: visitId, triage_status: newTriage, updated_at: now };
    await db.visits.update(visitId, payload);
    await enqueueOfflineAction('visits', 'UPDATE', payload);
  };

  const openEditModal = (visit) => {
    const patient = patientMap[visit.patient_id] || {};
    setEditingVisit(visit);
    setEditData({
      // Patient Info
      name: patient.name || '',
      phone: patient.phone || '',
      blood_group: patient.blood_group || '',
      allergies: patient.allergies || '',
      critical_history: patient.critical_history || '',
      // Visit Info
      triage_status: visit.triage_status || 'Green',
      chief_complaint: visit.chief_complaint || '',
      survival_info: visit.survival_info || '',
      age: visit.age || '',
      height: visit.height || '',
      weight: visit.weight || '',
      // Vitals
      bp: visit.vitals?.bp || '',
      spo2: visit.vitals?.spo2 || '',
      heartRate: visit.vitals?.heartRate || '',
      temp: visit.vitals?.temp || ''
    });
  };

  const handleFieldChange = (e) => {
    setEditData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveEdits = async (e) => {
    e.preventDefault();
    if (!editingVisit) return;
    const now = new Date().toISOString();

    // 1. Update Patient details
    const patientUpdate = {
      name: editData.name,
      phone: editData.phone,
      blood_group: editData.blood_group,
      allergies: editData.allergies,
      critical_history: editData.critical_history
    };
    await db.patients.update(editingVisit.patient_id, patientUpdate);
    await enqueueOfflineAction('patients', 'UPDATE', { id: editingVisit.patient_id, ...patientUpdate });

    // 2. Update Visit details
    const visitUpdate = {
      triage_status: editData.triage_status,
      chief_complaint: editData.chief_complaint,
      survival_info: editData.survival_info,
      age: parseInt(editData.age) || null,
      height: parseFloat(editData.height) || null,
      weight: parseFloat(editData.weight) || null,
      vitals: {
        bp: editData.bp,
        spo2: editData.spo2,
        heartRate: editData.heartRate,
        temp: editData.temp
      },
      updated_at: now
    };
    await db.visits.update(editingVisit.id, visitUpdate);
    await enqueueOfflineAction('visits', 'UPDATE', { id: editingVisit.id, ...visitUpdate });

    setEditingVisit(null);
  };

  const handleConfirmUpload = async (e) => {
    e.preventDefault();
    if (!editingVisit || !docFile) return;
    setDocUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        const docRecord = {
          id: generateUUID(),
          patient_id: editingVisit.patient_id,
          visit_id: editingVisit.id,
          document_type: docType,
          file_url: base64String,
          uploaded_at: new Date().toISOString()
        };
        await db.documents.add(docRecord);
        await enqueueOfflineAction('documents', 'INSERT', docRecord);

        setDocUploading(false);
        setDocFile(null);
        alert('Document uploaded successfully!');
      };
      reader.readAsDataURL(docFile);
    } catch (err) {
      console.error('Document upload failed', err);
      setDocUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await db.documents.delete(docId);
      await enqueueOfflineAction('documents', 'DELETE', { id: docId });
    } catch (err) {
      console.error('Failed to delete document', err);
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm('Are you sure you want to delete this patient visit? This action cannot be undone.')) return;
    try {
      await db.visits.delete(visitId);
      await enqueueOfflineAction('visits', 'DELETE', { id: visitId });
      setEditingVisit(null);
    } catch (err) {
      console.error('Failed to delete visit', err);
    }
  };

  const getTriageBadgeClasses = (t) => {
    if (t === 'Red') return 'bg-[#FDEBEC] text-[#9F2F2D]';
    if (t === 'Yellow') return 'bg-[#FBF3DB] text-[#956400]';
    return 'bg-[#EDF3EC] text-[#346538]';
  };

  const getTriageBorderClass = (t) => {
    if (t === 'Red') return 'border-l-[#9F2F2D]';
    if (t === 'Yellow') return 'border-l-[#956400]';
    return 'border-l-[#346538]';
  };

  return (
    <div className="w-full text-[#111111] bg-[#F9F9F8] min-h-full">
      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        {[
          { icon: <Users size={22} className="text-[#111111]" />, bg: 'bg-[#F9F9F8]', value: visits.length, label: 'Total Active', valColor: 'text-[#111111]' },
          { icon: <ShieldAlert size={22} className="text-[#9F2F2D]" />, bg: 'bg-[#FDEBEC]', value: countRed, label: 'Emergency (Red)', valColor: 'text-[#9F2F2D]', borderColor: 'border-[#9F2F2D]' },
          { icon: <AlertTriangle size={22} className="text-[#956400]" />, bg: 'bg-[#FBF3DB]', value: countYellow, label: 'Urgent (Yellow)', valColor: 'text-[#956400]', borderColor: 'border-[#956400]' },
          { icon: <CheckCircle size={22} className="text-[#346538]" />, bg: 'bg-[#EDF3EC]', value: countGreen, label: 'Standard (Green)', valColor: 'text-[#346538]', borderColor: 'border-[#346538]' },
          { icon: <Stethoscope size={22} className="text-[#111111]" />, bg: 'bg-[#F9F9F8]', value: countConsulting, label: 'With Doctor', valColor: 'text-[#111111]' }
        ].map(({ icon, bg, value, label, valColor, borderColor }, i) => (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} className={`bg-white border border-[#EAEAEA] rounded-xl p-4 flex items-center gap-3 ${borderColor ? `border-l-4 ${borderColor}` : ''}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
              {icon}
            </div>
            <div>
              <div className={`text-2xl font-bold ${valColor}`}>{value}</div>
              <div className="text-xs text-[#787774]">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-[#EAEAEA] rounded-xl px-4 py-3.5 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Filter size={16} className="text-[#111111]" />
          <span className="text-xs font-semibold text-[#787774]">Filter:</span>
          {['ALL', 'Red', 'Yellow', 'Green'].map((t) => (
            <button key={t} onClick={() => setFilterTriage(t)}
              className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                filterTriage === t
                  ? 'bg-[#111111] text-white font-medium'
                  : 'bg-[#F9F9F8] text-[#787774] hover:bg-[#EAEAEA]'
              }`}
            >{t}</button>
          ))}
        </div>
        <button onClick={() => setShowIntakeModal(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-md hover:scale-95 transition-transform focus:outline-none cursor-pointer">
          + Register New Patient
        </button>
      </motion.div>

      {/* ── Queue List ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-[#EAEAEA] rounded-xl p-12 text-center">
          <CheckCircle size={48} className="text-[#EAEAEA] mx-auto mb-4 opacity-80" />
          <h3 className="text-lg text-[#111111] font-medium mb-2">Queue is Clear</h3>
          <p className="text-[#787774] m-0">No active patients match the current filter.</p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((visit, idx) => {
              const patient = patientMap[visit.patient_id];
              if (!patient) return null;

              const doc = doctorMap[visit.doctor_id];

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: 0.1 + (idx * 0.05) }}
                  key={visit.id}
                  className={`bg-white border border-[#EAEAEA] rounded-xl p-5 border-l-4 ${getTriageBorderClass(visit.triage_status)}`}
                >
                  <div className="flex flex-wrap gap-5 justify-between">
                    
                    {/* Left: Patient Info */}
                    <div className="flex-1 min-w-[300px]">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-[#111111] m-0 mb-1 flex items-center gap-2.5">
                            {patient.name}
                            <span className={`text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full ${getTriageBadgeClasses(visit.triage_status)}`}>
                              {visit.triage_status}
                            </span>
                          </h3>
                          <div className="text-xs text-[#787774] flex gap-3">
                            <span>ID: {patient.id.slice(0, 8)}</span>
                            <span>{patient.gender}</span>
                            <span>{visit.age ? `${visit.age} yrs` : ''}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-[#9F2F2D]">{patient.blood_group}</div>
                          <div className="text-[10px] text-[#787774]">Blood</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3.5">
                        <div className="bg-[#F9F9F8] border border-[#EAEAEA] p-2.5 rounded-lg">
                          <div className="text-[10px] text-[#787774]">Assigned To</div>
                          <div className="text-sm text-[#111111] font-semibold">{doc ? `Dr. ${doc.full_name}` : 'Unassigned'}</div>
                        </div>
                        <div className="bg-[#F9F9F8] border border-[#EAEAEA] p-2.5 rounded-lg">
                          <div className="text-[10px] text-[#787774]">Chief Complaint</div>
                          <div className="text-sm text-[#111111] font-semibold">{visit.chief_complaint || '—'}</div>
                        </div>
                        <div className="bg-[#F9F9F8] border border-[#EAEAEA] p-2.5 rounded-lg">
                          <div className="text-[10px] text-[#787774]">Phone</div>
                          <div className="text-sm text-[#111111] font-semibold">{patient.phone || '—'}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4">
                        {visit.vitals && (
                          <div className="flex gap-3 text-xs text-[#787774]">
                            <span>BP: <strong className="text-[#111111]">{visit.vitals.bp || '—'}</strong></span>
                            <span>SpO2: <strong className="text-[#111111]">{visit.vitals.spo2 || '—'}</strong></span>
                            <span>HR: <strong className="text-[#111111]">{visit.vitals.heartRate || '—'}</strong></span>
                          </div>
                        )}
                        {visit.survival_info && (
                          <p className="text-xs text-[#787774] italic bg-[#F9F9F8] border border-[#EAEAEA] px-2.5 py-1.5 rounded-md m-0 mt-1">
                            "{visit.survival_info}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2 min-w-[190px]">

                      {visit.status === 'Waiting' && (
                        <button
                          onClick={() => handleSendToDoctor(visit.id)}
                          disabled={isDoctorBusy}
                          className={`flex items-center justify-between w-full text-xs px-3 py-2.5 rounded-md transition-transform ${
                            isDoctorBusy 
                              ? 'bg-[#F9F9F8] text-[#787774] border border-[#EAEAEA] cursor-not-allowed' 
                              : 'bg-[#111111] text-white hover:scale-95 cursor-pointer'
                          }`}
                          title={isDoctorBusy ? 'Doctor is currently busy with a patient' : ''}
                        >
                          <span>{isDoctorBusy ? 'Doctor Busy' : 'Send to Doctor'}</span>
                          <ChevronRight size={14} />
                        </button>
                      )}
                      
                      {visit.status === 'In Consultation' && (
                        <div className="w-full text-xs px-3 py-2.5 bg-[#FBF3DB] text-[#956400] rounded-md text-center font-semibold">
                          Sent to Doctor
                        </div>
                      )}
                      
                      {visit.status === 'In Progress' && (
                        <div className="flex items-center justify-center gap-2 w-full text-xs px-3 py-2.5 bg-[#F9F9F8] border border-[#EAEAEA] text-[#111111] rounded-md text-center font-semibold">
                          <Stethoscope size={16} /> With Doctor
                        </div>
                      )}

                      <button onClick={() => onSelectQR(visit.patient_id)} className="flex items-center justify-between w-full text-xs px-3 py-2 bg-white border border-[#EAEAEA] text-[#111111] rounded-md hover:scale-95 transition-transform cursor-pointer">
                        <span>Generate QR</span>
                        <QrCode size={14} className="text-[#111111]" />
                      </button>

                      <button onClick={() => openEditModal(visit)} className="flex items-center justify-between w-full text-xs px-3 py-2 bg-white border border-[#EAEAEA] text-[#111111] rounded-md hover:scale-95 transition-transform cursor-pointer">
                        <span>Edit Details</span>
                        <Edit size={14} className="text-[#111111]" />
                      </button>

                      <button onClick={() => handleDeleteVisit(visit.id)} className="flex items-center justify-between w-full text-xs px-3 py-2 bg-[#FDEBEC] border border-[#FDEBEC] text-[#9F2F2D] rounded-md hover:scale-95 transition-transform cursor-pointer">
                        <span>Delete</span>
                        <Trash2 size={14} className="text-[#9F2F2D]" />
                      </button>

                      {visit.triage_status !== 'Red' && visit.status === 'Waiting' && (
                        <button onClick={() => handleElevateTriage(visit.id, 'Red')} 
                          className="w-full text-[10px] px-2 py-1.5 bg-[#FDEBEC] text-[#9F2F2D] rounded-md mt-1 hover:scale-95 transition-transform cursor-pointer font-medium uppercase tracking-wider">
                          Elevate to RED
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Edit Patient/Visit Details Modal ──────────────────────────── */}
      <AnimatePresence>
        {editingVisit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-[1000] p-5 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="bg-white border border-[#EAEAEA] rounded-xl w-full max-w-3xl p-7 relative m-auto shadow-lg"
            >
              <button onClick={() => setEditingVisit(null)} className="absolute top-4 right-4 text-[#787774] hover:text-[#111111] bg-transparent border-none cursor-pointer transition-colors p-1">
                <X size={20} />
              </button>
              <div className="flex items-center gap-2.5 mb-5">
                <Edit size={22} className="text-[#111111]" />
                <h2 className="text-xl text-[#111111] font-bold m-0">
                  Edit Details — {editData.name || 'Patient'}
                </h2>
              </div>
              
              <form onSubmit={handleSaveEdits}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Column 1: Patient Identity & History */}
                  <div>
                    <h3 className="text-sm text-[#111111] flex items-center gap-1.5 mb-3 font-semibold">
                      <User size={16} /> Patient Identity
                    </h3>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-xs text-[#787774] mb-1">Full Name</label>
                        <input type="text" name="name" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.name} onChange={handleFieldChange} required />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs text-[#787774] mb-1">Phone</label>
                          <input type="text" name="phone" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.phone} onChange={handleFieldChange} />
                        </div>
                        <div>
                          <label className="block text-xs text-[#787774] mb-1">Blood Group</label>
                          <input type="text" name="blood_group" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.blood_group} onChange={handleFieldChange} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-[#9F2F2D] mb-1">Allergies</label>
                        <input type="text" name="allergies" className="w-full bg-[#FDEBEC]/50 border border-[#9F2F2D]/30 rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#9F2F2D] focus:bg-white" value={editData.allergies} onChange={handleFieldChange} />
                      </div>
                      <div>
                        <label className="block text-xs text-[#956400] mb-1">Critical Medical History</label>
                        <input type="text" name="critical_history" className="w-full bg-[#FBF3DB]/50 border border-[#956400]/30 rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#956400] focus:bg-white" value={editData.critical_history} onChange={handleFieldChange} />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Current Visit & Vitals */}
                  <div>
                    <h3 className="text-sm text-[#111111] flex items-center gap-1.5 mb-3 font-semibold">
                      <Activity size={16} /> Current Visit
                    </h3>
                    <div className="flex flex-col gap-3">
                      
                      <div>
                        <label className="block text-xs text-[#787774] mb-1.5">Triage Priority</label>
                        <div className="flex gap-2">
                          {[
                            { key: 'Red', label: 'Red', activeBg: 'bg-[#FDEBEC] text-[#9F2F2D] border-[#9F2F2D]/50' },
                            { key: 'Yellow', label: 'Yellow', activeBg: 'bg-[#FBF3DB] text-[#956400] border-[#956400]/50' },
                            { key: 'Green', label: 'Green', activeBg: 'bg-[#EDF3EC] text-[#346538] border-[#346538]/50' }
                          ].map(({ key, label, activeBg }) => (
                            <button key={key} type="button" onClick={() => setEditData({ ...editData, triage_status: key })}
                              className={`flex-1 py-1.5 text-xs rounded-md transition-colors border cursor-pointer font-medium ${
                                editData.triage_status === key 
                                  ? activeBg 
                                  : 'bg-[#F9F9F8] text-[#787774] border-[#EAEAEA] hover:bg-[#EAEAEA]'
                              }`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#787774] mb-1">Chief Complaint</label>
                        <input type="text" name="chief_complaint" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.chief_complaint} onChange={handleFieldChange} />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs text-[#787774] mb-1">BP</label>
                          <input type="text" name="bp" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.bp} onChange={handleFieldChange} />
                        </div>
                        <div>
                          <label className="block text-xs text-[#787774] mb-1">SpO2 (%)</label>
                          <input type="text" name="spo2" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.spo2} onChange={handleFieldChange} />
                        </div>
                        <div>
                          <label className="block text-xs text-[#787774] mb-1">Heart Rate</label>
                          <input type="text" name="heartRate" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.heartRate} onChange={handleFieldChange} />
                        </div>
                        <div>
                          <label className="block text-xs text-[#787774] mb-1">Temp (°F)</label>
                          <input type="text" name="temp" className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white" value={editData.temp} onChange={handleFieldChange} />
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* ASHA Note (Full Width) */}
                <div className="mt-4">
                  <label className="block text-xs text-[#787774] mb-1.5">ASHA Critical Intake Notes (for Doctor)</label>
                  <textarea name="survival_info" rows={2} className="w-full bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white resize-y" value={editData.survival_info} onChange={handleFieldChange} />
                </div>

                {/* Documents Management */}
                <div className="mt-6 pt-4 border-t border-[#EAEAEA]">
                  <h3 className="text-sm text-[#111111] flex items-center gap-1.5 mb-3 font-semibold">
                    <FileText size={16} /> Attached Documents
                  </h3>
                  
                  {/* Upload Section */}
                  <div className="flex gap-3 items-start mb-4 p-3 bg-[#F9F9F8] rounded-lg border border-[#EAEAEA]">
                    <div className="flex-1">
                      <select className="w-full bg-white border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] mb-2 cursor-pointer" value={docType} onChange={(e) => setDocType(e.target.value)}>
                        <option value="LAB_REPORT">Lab Report</option>
                        <option value="XRAY">X-Ray Image</option>
                        <option value="ECG">ECG / EKG</option>
                        <option value="PRESCRIPTION">Prescription</option>
                      </select>
                      <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files[0])} className="text-xs text-[#787774] w-full file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#EAEAEA] file:text-[#111111] hover:file:bg-[#D1D1D1] file:cursor-pointer cursor-pointer" />
                    </div>
                    <button type="button" onClick={handleConfirmUpload} disabled={!docFile || docUploading} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-md hover:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed h-fit cursor-pointer">
                      <Upload size={14} /> {docUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>

                  {/* List Section */}
                  <div className="flex flex-col gap-2">
                    {documents.filter(d => d.patient_id === editingVisit.patient_id).length === 0 ? (
                      <p className="text-xs text-[#787774] m-0">No documents uploaded.</p>
                    ) : (
                      documents.filter(d => d.patient_id === editingVisit.patient_id).map(doc => (
                        <div key={doc.id} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-[#EAEAEA]">
                          <div>
                            <div className="text-xs text-[#111111] font-semibold">{doc.document_type}</div>
                            <div className="text-[10px] text-[#787774]">{new Date(doc.uploaded_at).toLocaleString()}</div>
                          </div>
                          <button type="button" onClick={() => handleDeleteDoc(doc.id)} className="px-2 py-1 bg-[#FDEBEC] text-[#9F2F2D] text-[10px] rounded hover:scale-95 transition-transform cursor-pointer font-medium uppercase tracking-wider">
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-2.5 justify-between mt-6">
                  <button type="button" onClick={() => handleDeleteVisit(editingVisit.id)} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FDEBEC] text-[#9F2F2D] border border-[#FDEBEC] text-sm font-medium rounded-md hover:scale-95 transition-transform cursor-pointer">
                    <Trash2 size={15} /> Delete
                  </button>
                  <div className="flex gap-2.5">
                    <button type="button" onClick={() => setEditingVisit(null)} className="px-4 py-2 bg-white border border-[#EAEAEA] text-[#111111] text-sm font-medium rounded-md hover:scale-95 transition-transform cursor-pointer">Cancel</button>
                    <button type="submit" className="flex items-center justify-center gap-1.5 px-5 py-2 bg-[#111111] text-white text-sm font-medium rounded-md hover:scale-95 transition-transform cursor-pointer">
                      <Save size={15} /> Save All Details
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Intake Form Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showIntakeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 flex items-start justify-center z-[1000] p-5 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="w-full max-w-4xl relative my-5 mx-auto"
            >
              <button
                onClick={() => setShowIntakeModal(false)}
                className="absolute right-4 top-4 z-10 bg-white border border-[#EAEAEA] text-[#787774] hover:text-[#111111] p-2 rounded-full hover:scale-95 transition-transform cursor-pointer shadow-sm"
              >
                <X size={20} />
              </button>
              <TriageForm onTriageComplete={() => setShowIntakeModal(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
