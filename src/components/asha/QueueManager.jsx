import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  ChevronRight, 
  QrCode, 
  ArrowUpRight,
  Filter,
  Edit,
  X,
  Save
} from 'lucide-react';

export function QueueManager({ onSelectQR, onNavigateIntake }) {
  const [filterTriage, setFilterTriage] = useState('ALL');

  // Edit Modal state
  const [editingItem, setEditingItem] = useState(null); // { visit, patient }
  const [editFullName, setEditFullName] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editBloodGroup, setEditBloodGroup] = useState('O+');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');

  const [editTriageStatus, setEditTriageStatus] = useState('GREEN');
  const [editAge, setEditAge] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');

  const [editBp, setEditBp] = useState('');
  const [editSpo2, setEditSpo2] = useState('');
  const [editHeartRate, setEditHeartRate] = useState('');
  const [editTemp, setEditTemp] = useState('');
  const [editAshaInstructions, setEditAshaInstructions] = useState('');

  // Fetch all active visits and patients from Dexie IndexedDB
  const visits = useLiveQuery(() => db.visits.where('status').notEqual('COMPLETED').toArray(), []) || [];
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];

  const patientMap = patients.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Sort strictly according to API_SPEC.md: RED > YELLOW > GREEN, then created_at ASC
  const triagePriorityOrder = { RED: 1, YELLOW: 2, GREEN: 3 };

  const sortedVisits = [...visits].sort((a, b) => {
    const pA = triagePriorityOrder[a.triage_status] || 4;
    const pB = triagePriorityOrder[b.triage_status] || 4;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const filteredVisits = sortedVisits.filter((v) => {
    if (filterTriage === 'ALL') return true;
    return v.triage_status === filterTriage;
  });

  const countRed = visits.filter((v) => v.triage_status === 'RED' && v.status === 'WAITING').length;
  const countYellow = visits.filter((v) => v.triage_status === 'YELLOW' && v.status === 'WAITING').length;
  const countGreen = visits.filter((v) => v.triage_status === 'GREEN' && v.status === 'WAITING').length;
  const countInConsultation = visits.filter((v) => v.status === 'IN_CONSULTATION').length;

  const handleOpenEditModal = (visit, patient) => {
    const vitals = visit.vitals_summary ? JSON.parse(visit.vitals_summary) : {};
    
    setEditingItem({ visit, patient });
    setEditFullName(patient.full_name || '');
    setEditGender(patient.gender || 'Male');
    setEditBloodGroup(patient.blood_group || 'O+');
    setEditPhoneNumber(patient.phone_number || '');
    setEditEmergencyPhone(patient.emergency_phone || '');

    setEditTriageStatus(visit.triage_status || 'GREEN');
    setEditAge(visit.age_at_visit || '');
    setEditHeight(visit.height || '');
    setEditWeight(visit.weight || '');

    setEditBp(vitals.bp || '');
    setEditSpo2(vitals.spo2 ? vitals.spo2.replace('%', '') : '');
    setEditHeartRate(vitals.heartRate ? vitals.heartRate.replace(' bpm', '') : '');
    setEditTemp(vitals.temp ? vitals.temp.replace('°F', '') : '');
    setEditAshaInstructions(visit.asha_instructions || '');
  };

  const handleSavePatientEdits = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const now = new Date().toISOString();
      const patientId = editingItem.patient.id;
      const visitId = editingItem.visit.id;

      // 1. Update Patient record
      const updatedPatientPayload = {
        id: patientId,
        full_name: editFullName.trim(),
        gender: editGender,
        blood_group: editBloodGroup,
        phone_number: editPhoneNumber.trim(),
        emergency_phone: editEmergencyPhone.trim()
      };

      await db.patients.update(patientId, updatedPatientPayload);
      await enqueueOfflineAction('patients', 'UPDATE', updatedPatientPayload);

      // 2. Update Visit record
      const vitalsObj = {
        bp: editBp || '120/80',
        spo2: editSpo2 ? `${editSpo2}%` : '98%',
        heartRate: editHeartRate ? `${editHeartRate} bpm` : '75 bpm',
        temp: editTemp ? `${editTemp}°F` : '98.6°F'
      };

      const updatedVisitPayload = {
        id: visitId,
        triage_status: editTriageStatus,
        age_at_visit: parseInt(editAge) || 30,
        height: parseFloat(editHeight) || 165,
        weight: parseFloat(editWeight) || 60,
        vitals_summary: JSON.stringify(vitalsObj),
        asha_instructions: editAshaInstructions.trim(),
        updated_at: now
      };

      await db.visits.update(visitId, updatedVisitPayload);
      await enqueueOfflineAction('visits', 'UPDATE', updatedVisitPayload);

      setEditingItem(null);
    } catch (err) {
      console.error('Error saving patient edits:', err);
      alert('Failed to save patient edits.');
    }
  };

  const handleElevateTriage = async (visitId, newTriage) => {
    try {
      const now = new Date().toISOString();
      await db.visits.update(visitId, {
        triage_status: newTriage,
        updated_at: now
      });
      await enqueueOfflineAction('visits', 'UPDATE', {
        id: visitId,
        triage_status: newTriage,
        updated_at: now
      });
    } catch (err) {
      console.error('Error updating triage status:', err);
    }
  };

  const handleUpdateStatus = async (visitId, newStatus) => {
    try {
      const now = new Date().toISOString();
      await db.visits.update(visitId, {
        status: newStatus,
        updated_at: now
      });
      await enqueueOfflineAction('visits', 'UPDATE', {
        id: visitId,
        status: newStatus,
        updated_at: now
      });
    } catch (err) {
      console.error('Error updating visit status:', err);
    }
  };

  return (
    <div>
      {/* Metric Statistics Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color="#06b6d4" />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>{visits.length}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Active Patients</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fca5a5' }}>{countRed}</div>
            <div style={{ fontSize: '0.78rem', color: '#fca5a5' }}>Emergency (Red)</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fde047' }}>{countYellow}</div>
            <div style={{ fontSize: '0.78rem', color: '#fde047' }}>Urgent (Yellow)</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={22} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6ee7b7' }}>{countGreen}</div>
            <div style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>Standard (Green)</div>
          </div>
        </div>

      </div>

      {/* Queue Toolbar Controls */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={18} color="#06b6d4" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter Triage:</span>
          
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'RED', 'YELLOW', 'GREEN'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTriage(t)}
                className="btn"
                style={{
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  borderRadius: '20px',
                  background: filterTriage === t ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: filterTriage === t ? '#fff' : 'var(--text-muted)'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onNavigateIntake}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          + Add Patient to Queue
        </button>
      </div>

      {/* Queue Cards List */}
      {filteredVisits.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <Users size={40} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
          <h3 style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No patients matching this filter in queue.</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '4px' }}>
            Click "+ Add Patient to Queue" to record a new digital triage intake.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredVisits.map((visit, index) => {
            const patient = patientMap[visit.patient_id] || { full_name: 'Unknown Patient', blood_group: 'N/A', phone_number: 'N/A' };
            const vitals = visit.vitals_summary ? JSON.parse(visit.vitals_summary) : {};
            const isRed = visit.triage_status === 'RED';
            const isYellow = visit.triage_status === 'YELLOW';
            const isConsulting = visit.status === 'IN_CONSULTATION';

            return (
              <div
                key={visit.id}
                className={`glass-panel ${isRed && visit.status === 'WAITING' ? 'pulse-red' : ''}`}
                style={{
                  padding: '20px',
                  borderLeft: isRed ? '5px solid #ef4444' : isYellow ? '5px solid #f59e0b' : '5px solid #10b981',
                  background: isConsulting ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  
                  {/* Left Column: Position & Patient Details */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    
                    {/* Queue Priority Number */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      color: isRed ? '#fca5a5' : '#f8fafc'
                    }}>
                      #{index + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                          {patient.full_name}
                        </h3>
                        
                        {/* Triage Badge */}
                        <span className={`badge ${isRed ? 'badge-red' : isYellow ? 'badge-yellow' : 'badge-green'}`}>
                          {visit.triage_status === 'RED' ? '🚨 RED (Emergency)' : visit.triage_status === 'YELLOW' ? '⚠️ YELLOW (Urgent)' : '🟢 GREEN (Standard)'}
                        </span>

                        {isConsulting && (
                          <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.2)', border: '1px solid #06b6d4', color: '#67e8f9' }}>
                            🩺 IN CONSULTATION WITH DOCTOR
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>Gender: <strong style={{ color: '#e2e8f0' }}>{patient.gender}</strong></span>
                        <span>Blood: <strong style={{ color: '#e2e8f0' }}>{patient.blood_group}</strong></span>
                        <span>Age: <strong style={{ color: '#e2e8f0' }}>{visit.age_at_visit} yrs</strong></span>
                        <span>Phone: <strong style={{ color: '#e2e8f0' }}>{patient.phone_number}</strong></span>
                        <span>Queued: <strong style={{ color: '#e2e8f0' }}>{new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      </div>

                      {/* Vitals Ribbon */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <div style={{ padding: '4px 10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                          BP: <strong style={{ color: '#06b6d4' }}>{vitals.bp || '120/80'}</strong>
                        </div>
                        <div style={{ padding: '4px 10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                          SpO2: <strong style={{ color: '#10b981' }}>{vitals.spo2 || '98%'}</strong>
                        </div>
                        <div style={{ padding: '4px 10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                          Pulse: <strong style={{ color: '#f59e0b' }}>{vitals.heartRate || '75 bpm'}</strong>
                        </div>
                        <div style={{ padding: '4px 10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                          Temp: <strong style={{ color: '#e2e8f0' }}>{vitals.temp || '98.6°F'}</strong>
                        </div>
                      </div>

                      {/* ASHA Instructions */}
                      {visit.asha_instructions && (
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '6px' }}>
                          " {visit.asha_instructions} "
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '180px' }}>
                    
                    {/* Status Workflow Controls */}
                    {visit.status === 'WAITING' ? (
                      <button
                        onClick={() => handleUpdateStatus(visit.id, 'IN_CONSULTATION')}
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}
                      >
                        <span>Send to Doctor</span>
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(visit.id, 'COMPLETED')}
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}
                      >
                        <span>Mark Visit Completed</span>
                        <CheckCircle size={14} />
                      </button>
                    )}

                    {/* QR Code Quick Action */}
                    <button
                      onClick={() => onSelectQR(visit.patient_id)}
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}
                    >
                      <span>Generate QR Code</span>
                      <QrCode size={14} color="#06b6d4" />
                    </button>

                    {/* Edit Patient Details Action */}
                    <button
                      onClick={() => handleOpenEditModal(visit, patient)}
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                    >
                      <span>Edit Patient Details</span>
                      <Edit size={14} color="#06b6d4" />
                    </button>

                    {/* Emergency Re-triage Override */}
                    {!isRed && (
                      <button
                        onClick={() => handleElevateTriage(visit.id, 'RED')}
                        className="btn"
                        style={{
                          width: '100%',
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          color: '#fca5a5'
                        }}
                      >
                        🚨 Elevate to RED Emergency
                      </button>
                    )}

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Patient Modal Overlay */}
      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            
            <button
              onClick={() => setEditingItem(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Edit size={24} color="#06b6d4" />
              <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
                Edit Patient & Visit Details — {editingItem.patient.full_name}
              </h2>
            </div>

            <form onSubmit={handleSavePatientEdits}>
              
              {/* Patient Profile Details */}
              <h3 style={{ fontSize: '0.95rem', color: '#06b6d4', marginBottom: '12px' }}>1. Patient Profile Information</h3>
              <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Full Name</label>
                  <input type="text" className="input-field" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Gender</label>
                  <select className="input-field" value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Blood Group</label>
                  <select className="input-field" value={editBloodGroup} onChange={(e) => setEditBloodGroup(e.target.value)}>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Phone Number</label>
                  <input type="text" className="input-field" value={editPhoneNumber} onChange={(e) => setEditPhoneNumber(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Emergency Contact Phone</label>
                  <input type="text" className="input-field" value={editEmergencyPhone} onChange={(e) => setEditEmergencyPhone(e.target.value)} />
                </div>
              </div>

              {/* Triage & Vitals */}
              <h3 style={{ fontSize: '0.95rem', color: '#06b6d4', marginBottom: '12px' }}>2. Visit Vitals & Triage Status</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Triage Priority Level</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { level: 'RED', label: '🚨 RED (Emergency)' },
                    { level: 'YELLOW', label: '⚠️ YELLOW (Urgent)' },
                    { level: 'GREEN', label: '🟢 GREEN (Standard)' }
                  ].map((t) => (
                    <button
                      key={t.level}
                      type="button"
                      onClick={() => setEditTriageStatus(t.level)}
                      className="btn"
                      style={{
                        flex: 1,
                        fontSize: '0.8rem',
                        padding: '8px',
                        background: editTriageStatus === t.level ? (t.level === 'RED' ? 'var(--triage-red-bg)' : t.level === 'YELLOW' ? 'var(--triage-yellow-bg)' : 'var(--triage-green-bg)') : 'rgba(15,23,42,0.5)',
                        borderColor: editTriageStatus === t.level ? (t.level === 'RED' ? '#ef4444' : t.level === 'YELLOW' ? '#f59e0b' : '#10b981') : 'var(--border-color)',
                        color: editTriageStatus === t.level ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Age (Yrs)</label>
                  <input type="number" className="input-field" value={editAge} onChange={(e) => setEditAge(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>BP (sys/dia)</label>
                  <input type="text" className="input-field" placeholder="120/80" value={editBp} onChange={(e) => setEditBp(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SpO2 (%)</label>
                  <input type="text" className="input-field" placeholder="98" value={editSpo2} onChange={(e) => setEditSpo2(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Pulse (bpm)</label>
                  <input type="text" className="input-field" placeholder="78" value={editHeartRate} onChange={(e) => setEditHeartRate(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Temp (°F)</label>
                  <input type="text" className="input-field" placeholder="98.6" value={editTemp} onChange={(e) => setEditTemp(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ASHA Instructions / Notes for Doctor</label>
                <textarea className="input-field" rows={2} value={editAshaInstructions} onChange={(e) => setEditAshaInstructions(e.target.value)} />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

