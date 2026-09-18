import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import {
  Users, AlertTriangle, CheckCircle, ShieldAlert,
  ChevronRight, QrCode, Filter, Edit, X, Save, Stethoscope, Clock,
  Upload, FileUp, FileText, User, Activity
} from 'lucide-react';
import { TriageForm } from './TriageForm'; // Import TriageForm

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

  // Badge styles
  const triageBadgeClass = (t) => t === 'Red' ? 'badge badge-red' : t === 'Yellow' ? 'badge badge-yellow' : 'badge badge-green';
  const triageBorderColor = (t) => t === 'Red' ? '#ef4444' : t === 'Yellow' ? '#f59e0b' : '#10b981';

  return (
    <div>
      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { icon: <Users size={22} color="#06b6d4" />, bg: 'rgba(6,182,212,0.15)', value: visits.length, label: 'Total Active', color: '#f8fafc' },
          { icon: <ShieldAlert size={22} color="#ef4444" />, bg: 'rgba(239,68,68,0.15)', value: countRed, label: 'Emergency (Red)', color: '#fca5a5', borderColor: '#ef4444' },
          { icon: <AlertTriangle size={22} color="#f59e0b" />, bg: 'rgba(245,158,11,0.15)', value: countYellow, label: 'Urgent (Yellow)', color: '#fde047', borderColor: '#f59e0b' },
          { icon: <CheckCircle size={22} color="#10b981" />, bg: 'rgba(16,185,129,0.15)', value: countGreen, label: 'Standard (Green)', color: '#6ee7b7', borderColor: '#10b981' },
          { icon: <Stethoscope size={22} color="#06b6d4" />, bg: 'rgba(6,182,212,0.12)', value: countConsulting, label: 'With Doctor', color: '#67e8f9', borderColor: '#06b6d4' }
        ].map(({ icon, bg, value, label, color, borderColor }, i) => (
          <div key={i} className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: borderColor ? `4px solid ${borderColor}` : undefined }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Filter size={16} color="#06b6d4" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter:</span>
          {['ALL', 'Red', 'Yellow', 'Green'].map((t) => (
            <button key={t} onClick={() => setFilterTriage(t)}
              style={{
                padding: '4px 12px', fontSize: '0.75rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: filterTriage === t ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: filterTriage === t ? '#fff' : 'var(--text-muted)'
              }}
            >{t}</button>
          ))}
        </div>
        <button onClick={() => setShowIntakeModal(true)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          + Register New Patient
        </button>
      </div>

      {/* ── Queue List ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <CheckCircle size={48} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', margin: '0 0 8px' }}>Queue is Clear</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No active patients match the current filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map((visit) => {
            const patient = patientMap[visit.patient_id];
            if (!patient) return null;

            const doc = doctorMap[visit.doctor_id];

            return (
              <div key={visit.id} className="glass-panel" style={{ padding: '20px', borderLeft: `4px solid ${triageBorderColor(visit.triage_status)}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between' }}>
                  
                  {/* Left: Patient Info */}
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {patient.name}
                          <span className={triageBadgeClass(visit.triage_status)} style={{ fontSize: '0.7rem' }}>
                            {visit.triage_status}
                          </span>
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                          <span>ID: {patient.id.slice(0, 8)}</span>
                          <span>{patient.gender}</span>
                          <span>{visit.age ? `${visit.age} yrs` : ''}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>{patient.blood_group}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Blood</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Assigned To</div>
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{doc ? `Dr. ${doc.full_name}` : 'Unassigned'}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chief Complaint</div>
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{visit.chief_complaint || '—'}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Phone</div>
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{patient.phone || '—'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      {visit.vitals && (
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#94a3b8' }}>
                          <span>BP: <strong style={{ color: '#06b6d4' }}>{visit.vitals.bp || '—'}</strong></span>
                          <span>SpO2: <strong style={{ color: '#10b981' }}>{visit.vitals.spo2 || '—'}</strong></span>
                          <span>HR: <strong style={{ color: '#f59e0b' }}>{visit.vitals.heartRate || '—'}</strong></span>
                        </div>
                      )}
                      {visit.survival_info && (
                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', margin: '4px 0 0' }}>
                          "{visit.survival_info}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '190px' }}>

                    {visit.status === 'Waiting' && (
                      <button
                        onClick={() => handleSendToDoctor(visit.id)}
                        className="btn"
                        disabled={isDoctorBusy}
                        style={{
                          width: '100%', fontSize: '0.82rem', padding: '9px 12px',
                          justifyContent: 'space-between',
                          background: isDoctorBusy ? 'rgba(255,255,255,0.05)' : 'rgba(13,148,136,0.2)', 
                          border: isDoctorBusy ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(13,148,136,0.5)',
                          color: isDoctorBusy ? '#64748b' : '#5eead4',
                          cursor: isDoctorBusy ? 'not-allowed' : 'pointer'
                        }}
                        title={isDoctorBusy ? 'Doctor is currently busy with a patient' : ''}
                      >
                        <span>{isDoctorBusy ? 'Doctor Busy' : 'Send to Doctor'}</span>
                        <ChevronRight size={14} />
                      </button>
                    )}
                    
                    {visit.status === 'In Consultation' && (
                      <div style={{
                        width: '100%', fontSize: '0.82rem', padding: '9px 12px',
                        background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                        color: '#fde047', borderRadius: '8px', textAlign: 'center', fontWeight: 600
                      }}>
                        Sent to Doctor
                      </div>
                    )}
                    
                    {visit.status === 'In Progress' && (
                      <div style={{
                        width: '100%', fontSize: '0.82rem', padding: '9px 12px',
                        background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                        color: '#93c5fd', borderRadius: '8px', textAlign: 'center', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}>
                        <Stethoscope size={16} /> With Doctor
                      </div>
                    )}

                    <button onClick={() => onSelectQR(visit.patient_id)} className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}>
                      <span>Generate QR</span>
                      <QrCode size={14} color="#06b6d4" />
                    </button>

                    <button onClick={() => openEditModal(visit)} className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between', borderColor: 'rgba(6,182,212,0.3)' }}>
                      <span>Edit Details</span>
                      <Edit size={14} color="#06b6d4" />
                    </button>

                    {visit.triage_status !== 'Red' && visit.status === 'Waiting' && (
                      <button onClick={() => handleElevateTriage(visit.id, 'Red')} className="btn"
                        style={{ width: '100%', fontSize: '0.75rem', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5', marginTop: '4px' }}>
                        🚨 Elevate to RED
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Patient/Visit Details Modal ──────────────────────────── */}
      {editingVisit && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
          overflowY: 'auto'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', padding: '28px', position: 'relative', margin: 'auto' }}>
            <button onClick={() => setEditingVisit(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Edit size={22} color="#06b6d4" />
              <h2 style={{ fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
                Edit Details — {editData.name || 'Patient'}
              </h2>
            </div>
            
            <form onSubmit={handleSaveEdits}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Column 1: Patient Identity & History */}
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <User size={16} /> Patient Identity
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Full Name</label>
                      <input type="text" name="name" className="input-field" value={editData.name} onChange={handleFieldChange} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Phone</label>
                        <input type="text" name="phone" className="input-field" value={editData.phone} onChange={handleFieldChange} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Blood Group</label>
                        <input type="text" name="blood_group" className="input-field" value={editData.blood_group} onChange={handleFieldChange} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#fca5a5', marginBottom: '4px' }}>Allergies</label>
                      <input type="text" name="allergies" className="input-field" value={editData.allergies} onChange={handleFieldChange} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#fde047', marginBottom: '4px' }}>Critical Medical History</label>
                      <input type="text" name="critical_history" className="input-field" value={editData.critical_history} onChange={handleFieldChange} />
                    </div>
                  </div>
                </div>

                {/* Column 2: Current Visit & Vitals */}
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <Activity size={16} /> Current Visit
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Triage Priority</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                          { key: 'Red', label: 'Red', bg: 'var(--triage-red-bg)', border: '#ef4444' },
                          { key: 'Yellow', label: 'Yellow', bg: 'var(--triage-yellow-bg)', border: '#f59e0b' },
                          { key: 'Green', label: 'Green', bg: 'var(--triage-green-bg)', border: '#10b981' }
                        ].map(({ key, label, bg, border }) => (
                          <button key={key} type="button" onClick={() => setEditData({ ...editData, triage_status: key })}
                            style={{
                              flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${editData.triage_status === key ? border : 'var(--border-color)'}`,
                              background: editData.triage_status === key ? bg : 'rgba(15,23,42,0.5)', color: editData.triage_status === key ? '#fff' : 'var(--text-muted)'
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Chief Complaint</label>
                      <input type="text" name="chief_complaint" className="input-field" value={editData.chief_complaint} onChange={handleFieldChange} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>BP</label>
                        <input type="text" name="bp" className="input-field" value={editData.bp} onChange={handleFieldChange} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SpO2 (%)</label>
                        <input type="text" name="spo2" className="input-field" value={editData.spo2} onChange={handleFieldChange} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Heart Rate</label>
                        <input type="text" name="heartRate" className="input-field" value={editData.heartRate} onChange={handleFieldChange} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Temp (°F)</label>
                        <input type="text" name="temp" className="input-field" value={editData.temp} onChange={handleFieldChange} />
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* ASHA Note (Full Width) */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>ASHA Critical Intake Notes (for Doctor)</label>
                <textarea name="survival_info" className="input-field" rows={2} value={editData.survival_info} onChange={handleFieldChange} style={{ resize: 'vertical' }} />
              </div>

              {/* Documents Management */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <FileText size={16} /> Attached Documents
                </h3>
                
                {/* Upload Section */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px', padding: '12px', background: 'rgba(15,23,42,0.3)', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <select className="input-field" value={docType} onChange={(e) => setDocType(e.target.value)} style={{ marginBottom: '8px' }}>
                      <option value="LAB_REPORT">Lab Report</option>
                      <option value="XRAY">X-Ray Image</option>
                      <option value="ECG">ECG / EKG</option>
                      <option value="PRESCRIPTION">Prescription</option>
                    </select>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files[0])} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '100%' }} />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleConfirmUpload} disabled={!docFile || docUploading} style={{ padding: '8px 16px', height: 'fit-content' }}>
                    <Upload size={14} /> {docUploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>

                {/* List Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documents.filter(d => d.patient_id === editingVisit.patient_id).length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>No documents uploaded.</p>
                  ) : (
                    documents.filter(d => d.patient_id === editingVisit.patient_id).map(doc => (
                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(15,23,42,0.5)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 600 }}>{doc.document_type}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{new Date(doc.uploaded_at).toLocaleString()}</div>
                        </div>
                        <button type="button" onClick={() => handleDeleteDoc(doc.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingVisit(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  <Save size={15} /> Save All Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Intake Form Modal ─────────────────────────────────────────── */}
      {showIntakeModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{ width: '100%', maxWidth: '960px', position: 'relative', margin: '20px auto' }}>
            <button
              onClick={() => setShowIntakeModal(false)}
              style={{
                position: 'absolute', right: '16px', top: '16px', zIndex: 10,
                background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-color)',
                color: '#f8fafc', padding: '8px', borderRadius: '50%', cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <TriageForm onTriageComplete={() => setShowIntakeModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
