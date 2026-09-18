import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  ChevronRight,
  QrCode,
  Filter,
  Edit,
  X,
  Save
} from 'lucide-react';

// Title-case triage → priority order for sorting (Red > Yellow > Green)
const TRIAGE_PRIORITY = { Red: 1, Yellow: 2, Green: 3 };

export function QueueManager({ onSelectQR, onNavigateIntake }) {
  const [filterTriage, setFilterTriage] = useState('ALL');

  // Edit Modal state
  const [editingItem, setEditingItem] = useState(null); // { queueEntry, patient }
  const [editFullName, setEditFullName] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editBloodGroup, setEditBloodGroup] = useState('O+');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');

  const [editTriageStatus, setEditTriageStatus] = useState('Green');
  const [editAge, setEditAge] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editBp, setEditBp] = useState('');
  const [editSpo2, setEditSpo2] = useState('');
  const [editHeartRate, setEditHeartRate] = useState('');
  const [editTemp, setEditTemp] = useState('');
  const [editSurvivalInfo, setEditSurvivalInfo] = useState('');

  // Fetch all active queue entries and patients from Dexie IndexedDB
  const queueEntries = useLiveQuery(
    () => db.queue.where('status').notEqual('Completed').toArray(),
    []
  ) || [];
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];

  const patientMap = patients.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Sort: Red > Yellow > Green, then FIFO by created_at
  const sortedEntries = [...queueEntries].sort((a, b) => {
    const pA = TRIAGE_PRIORITY[a.triage_status] ?? 4;
    const pB = TRIAGE_PRIORITY[b.triage_status] ?? 4;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const filteredEntries = sortedEntries.filter((q) => {
    if (filterTriage === 'ALL') return true;
    return q.triage_status === filterTriage;
  });

  const countRed = queueEntries.filter((q) => q.triage_status === 'Red' && q.status === 'Waiting').length;
  const countYellow = queueEntries.filter((q) => q.triage_status === 'Yellow' && q.status === 'Waiting').length;
  const countGreen = queueEntries.filter((q) => q.triage_status === 'Green' && q.status === 'Waiting').length;
  const countInProgress = queueEntries.filter((q) => q.status === 'In Progress').length;

  const handleOpenEditModal = (queueEntry, patient) => {
    const vitals = queueEntry.vitals || {};
    setEditingItem({ queueEntry, patient });
    setEditFullName(patient.name || '');
    setEditGender(patient.gender || 'Male');
    setEditBloodGroup(patient.blood_group || 'O+');
    setEditPhoneNumber(patient.phone || '');
    setEditEmergencyPhone(patient.emergency_phone || '');

    setEditTriageStatus(queueEntry.triage_status || 'Green');
    setEditAge(queueEntry.age || '');
    setEditHeight(queueEntry.height || '');
    setEditWeight(queueEntry.weight || '');

    // Vitals stored as plain object
    setEditBp(vitals.bp || '');
    setEditSpo2(vitals.spo2 ? vitals.spo2.replace('%', '') : '');
    setEditHeartRate(vitals.heartRate ? vitals.heartRate.replace(' bpm', '') : '');
    setEditTemp(vitals.temp ? vitals.temp.replace('°F', '') : '');
    setEditSurvivalInfo(queueEntry.survival_info || '');
  };

  const handleSavePatientEdits = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const now = new Date().toISOString();
      const patientId = editingItem.patient.id;
      const queueId = editingItem.queueEntry.id;

      // 1. Update Patient record
      const updatedPatient = {
        id: patientId,
        name: editFullName.trim(),
        gender: editGender,
        blood_group: editBloodGroup,
        phone: editPhoneNumber.trim(),
        emergency_phone: editEmergencyPhone.trim()
      };

      await db.patients.update(patientId, updatedPatient);
      await enqueueOfflineAction('patients', 'UPDATE', updatedPatient);

      // 2. Update Queue entry
      const vitalsObj = {
        bp: editBp || '120/80',
        spo2: editSpo2 ? `${editSpo2}%` : '98%',
        heartRate: editHeartRate ? `${editHeartRate} bpm` : '75 bpm',
        temp: editTemp ? `${editTemp}°F` : '98.6°F'
      };

      const updatedQueue = {
        id: queueId,
        triage_status: editTriageStatus,
        age: parseInt(editAge) || null,
        height: parseFloat(editHeight) || null,
        weight: parseFloat(editWeight) || null,
        vitals: vitalsObj,
        survival_info: editSurvivalInfo.trim(),
        updated_at: now
      };

      await db.queue.update(queueId, updatedQueue);
      await enqueueOfflineAction('queue', 'UPDATE', updatedQueue);

      setEditingItem(null);
    } catch (err) {
      console.error('Error saving patient edits:', err);
      alert('Failed to save patient edits.');
    }
  };

  const handleElevateTriage = async (queueId, newTriage) => {
    try {
      const now = new Date().toISOString();
      const payload = { id: queueId, triage_status: newTriage, updated_at: now };
      await db.queue.update(queueId, payload);
      await enqueueOfflineAction('queue', 'UPDATE', payload);
    } catch (err) {
      console.error('Error updating triage status:', err);
    }
  };

  const handleUpdateStatus = async (queueId, newStatus) => {
    try {
      const now = new Date().toISOString();
      const payload = { id: queueId, status: newStatus, updated_at: now };
      await db.queue.update(queueId, payload);
      await enqueueOfflineAction('queue', 'UPDATE', payload);
    } catch (err) {
      console.error('Error updating queue status:', err);
    }
  };

  return (
    <div>
      {/* Metric Stats Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>

        <div className="glass-panel" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color="#06b6d4" />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>{queueEntries.length}</div>
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

      {/* Queue Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={18} color="#06b6d4" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter Triage:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'Red', 'Yellow', 'Green'].map((t) => (
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

      {/* Queue Cards */}
      {filteredEntries.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <Users size={40} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
          <h3 style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No patients matching this filter in queue.</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '4px' }}>
            Click "+ Add Patient to Queue" to record a new digital triage intake.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredEntries.map((qEntry, index) => {
            const patient = patientMap[qEntry.patient_id] || { name: 'Unknown Patient', blood_group: 'N/A', phone: 'N/A' };
            const vitals = qEntry.vitals || {};
            const isRed = qEntry.triage_status === 'Red';
            const isYellow = qEntry.triage_status === 'Yellow';
            const isInProgress = qEntry.status === 'In Progress';

            return (
              <div
                key={qEntry.id}
                className={`glass-panel ${isRed && qEntry.status === 'Waiting' ? 'pulse-red' : ''}`}
                style={{
                  padding: '20px',
                  borderLeft: isRed ? '5px solid #ef4444' : isYellow ? '5px solid #f59e0b' : '5px solid #10b981',
                  background: isInProgress ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>

                  {/* Left: Queue Position & Patient Details */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1.1rem', color: isRed ? '#fca5a5' : '#f8fafc'
                    }}>
                      #{index + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                          {patient.name}
                        </h3>
                        <span className={`badge ${isRed ? 'badge-red' : isYellow ? 'badge-yellow' : 'badge-green'}`}>
                          {qEntry.triage_status === 'Red' ? '🚨 RED (Emergency)' : qEntry.triage_status === 'Yellow' ? '⚠️ YELLOW (Urgent)' : '🟢 GREEN (Standard)'}
                        </span>
                        {isInProgress && (
                          <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.2)', border: '1px solid #06b6d4', color: '#67e8f9' }}>
                            🩺 IN CONSULTATION WITH DOCTOR
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>Gender: <strong style={{ color: '#e2e8f0' }}>{patient.gender}</strong></span>
                        <span>Blood: <strong style={{ color: '#e2e8f0' }}>{patient.blood_group}</strong></span>
                        <span>Age: <strong style={{ color: '#e2e8f0' }}>{qEntry.age} yrs</strong></span>
                        <span>Phone: <strong style={{ color: '#e2e8f0' }}>{patient.phone}</strong></span>
                        <span>Queued: <strong style={{ color: '#e2e8f0' }}>{new Date(qEntry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      </div>

                      {/* Vitals Ribbon */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'BP', value: vitals.bp || '—', color: '#06b6d4' },
                          { label: 'SpO2', value: vitals.spo2 || '—', color: '#10b981' },
                          { label: 'Pulse', value: vitals.heartRate || '—', color: '#f59e0b' },
                          { label: 'Temp', value: vitals.temp || '—', color: '#e2e8f0' }
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ padding: '4px 10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                            {label}: <strong style={{ color }}>{value}</strong>
                          </div>
                        ))}
                      </div>

                      {/* ASHA Notes */}
                      {qEntry.survival_info && (
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '6px' }}>
                          "{qEntry.survival_info}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '180px' }}>

                    {qEntry.status === 'Waiting' ? (
                      <button
                        onClick={() => handleUpdateStatus(qEntry.id, 'In Progress')}
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}
                      >
                        <span>Send to Doctor</span>
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(qEntry.id, 'Completed')}
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}
                      >
                        <span>Mark Completed</span>
                        <CheckCircle size={14} />
                      </button>
                    )}

                    <button
                      onClick={() => onSelectQR(qEntry.patient_id)}
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between' }}
                    >
                      <span>Generate QR Code</span>
                      <QrCode size={14} color="#06b6d4" />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(qEntry, patient)}
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'space-between', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                    >
                      <span>Edit Patient Details</span>
                      <Edit size={14} color="#06b6d4" />
                    </button>

                    {qEntry.triage_status !== 'Red' && (
                      <button
                        onClick={() => handleElevateTriage(qEntry.id, 'Red')}
                        className="btn"
                        style={{ width: '100%', fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}
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

      {/* Edit Patient Modal */}
      {editingItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
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
                Edit Patient & Visit Details — {editingItem.patient.name}
              </h2>
            </div>

            <form onSubmit={handleSavePatientEdits}>

              {/* Patient Profile */}
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
                    { level: 'Red', label: '🚨 RED (Emergency)', bg: 'var(--triage-red-bg)', border: '#ef4444' },
                    { level: 'Yellow', label: '⚠️ YELLOW (Urgent)', bg: 'var(--triage-yellow-bg)', border: '#f59e0b' },
                    { level: 'Green', label: '🟢 GREEN (Standard)', bg: 'var(--triage-green-bg)', border: '#10b981' }
                  ].map((t) => (
                    <button
                      key={t.level}
                      type="button"
                      onClick={() => setEditTriageStatus(t.level)}
                      className="btn"
                      style={{
                        flex: 1, fontSize: '0.8rem', padding: '8px',
                        background: editTriageStatus === t.level ? t.bg : 'rgba(15,23,42,0.5)',
                        borderColor: editTriageStatus === t.level ? t.border : 'var(--border-color)',
                        color: editTriageStatus === t.level ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: '16px' }}>
                {[
                  { label: 'Age (Yrs)', value: editAge, setter: setEditAge, type: 'number' },
                  { label: 'BP (sys/dia)', value: editBp, setter: setEditBp, placeholder: '120/80', type: 'text' },
                  { label: 'SpO2 (%)', value: editSpo2, setter: setEditSpo2, placeholder: '98', type: 'text' },
                  { label: 'Pulse (bpm)', value: editHeartRate, setter: setEditHeartRate, placeholder: '78', type: 'text' },
                  { label: 'Temp (°F)', value: editTemp, setter: setEditTemp, placeholder: '98.6', type: 'text' }
                ].map(({ label, value, setter, placeholder, type }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                    <input type={type} className="input-field" placeholder={placeholder} value={value} onChange={(e) => setter(e.target.value)} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ASHA Instructions / Notes for Doctor</label>
                <textarea className="input-field" rows={2} value={editSurvivalInfo} onChange={(e) => setEditSurvivalInfo(e.target.value)} />
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
