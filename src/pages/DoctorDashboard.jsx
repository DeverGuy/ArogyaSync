import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { enqueueOfflineAction } from '../lib/syncManager';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  User,
  Activity,
  FileText,
  ChevronRight,
  CheckCircle,
  Save,
  Stethoscope,
  Wifi,
  WifiOff,
  Users,
  ClipboardList
} from 'lucide-react';

/**
 * Doctor Dashboard (Urban Gateway Node)
 *
 * Data flow:
 *  - Primary: reads from Dexie IndexedDB (same local DB the ASHA dashboard writes to)
 *  - When online + Supabase configured: subscribes to Supabase Realtime on 'queue' table
 *    and triggers a Dexie re-read on changes (bridging realtime updates)
 *  - Writes (patient updates, consultation completion) go to both Dexie and
 *    the sync queue for Supabase replay
 *
 * Schema aligned with Supabase (Moksh's migration):
 *   patients: name, phone, emergency_phone, blood_group, gender, height, weight, age, vitals (object), notes
 *   queue: patient_id, triage_status ('Red'|'Yellow'|'Green'), survival_info,
 *          status ('Waiting'|'In Progress'|'Completed'), age, height, weight, vitals (object)
 */
export default function DoctorDashboard() {
  const [currentQueueId, setCurrentQueueId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Live queue from Dexie — sorted Red > Yellow > Green, only Waiting + In Progress
  const queueEntries = useLiveQuery(
    () => db.queue.where('status').notEqual('Completed').toArray(),
    []
  ) || [];

  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];

  const patientMap = patients.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const TRIAGE_PRIORITY = { Red: 1, Yellow: 2, Green: 3 };
  const sortedQueue = [...queueEntries].sort((a, b) => {
    const pA = TRIAGE_PRIORITY[a.triage_status] ?? 4;
    const pB = TRIAGE_PRIORITY[b.triage_status] ?? 4;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const waitingQueue = sortedQueue.filter(q => q.status === 'Waiting');

  // The active queue entry being consulted
  const currentQueueEntry = currentQueueId
    ? queueEntries.find(q => q.id === currentQueueId) ?? null
    : null;
  const currentPatientData = currentQueueEntry
    ? patientMap[currentQueueEntry.patient_id] ?? null
    : null;

  // Local editable state for the current patient's fields
  const [editedPatient, setEditedPatient] = useState(null);
  const [editedQueue, setEditedQueue] = useState(null);

  // Sync editedPatient/editedQueue when selection changes
  useEffect(() => {
    if (currentPatientData) {
      setEditedPatient({ ...currentPatientData });
    } else {
      setEditedPatient(null);
    }
    if (currentQueueEntry) {
      setEditedQueue({ ...currentQueueEntry });
    } else {
      setEditedQueue(null);
    }
  }, [currentQueueId, currentPatientData?.id, currentQueueEntry?.id]);

  // Auto-select first waiting patient if none selected
  useEffect(() => {
    if (!currentQueueId && waitingQueue.length > 0) {
      setCurrentQueueId(waitingQueue[0].id);
    }
  }, [waitingQueue.length]);

  // Supabase Realtime subscription — bridges cloud updates into Dexie
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let subscription = null;
    if (isSupabaseConfigured) {
      subscription = supabase
        .channel('doctor_queue_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, async (payload) => {
          // Upsert remote change into local Dexie so useLiveQuery picks it up
          try {
            if (payload.eventType === 'DELETE') {
              await db.queue.delete(payload.old.id);
            } else {
              const record = payload.new;
              await db.queue.put(record);
            }
          } catch (e) {
            console.warn('[DoctorDashboard] Dexie upsert from realtime failed:', e);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, async (payload) => {
          try {
            if (payload.eventType !== 'DELETE') {
              await db.patients.put(payload.new);
            }
          } catch (e) {
            console.warn('[DoctorDashboard] Dexie patient upsert from realtime failed:', e);
          }
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const handlePatientFieldChange = (e) => {
    const { name, value } = e.target;
    setEditedPatient(prev => ({ ...prev, [name]: value }));
  };

  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    setEditedQueue(prev => ({
      ...prev,
      vitals: { ...(prev?.vitals || {}), [name]: value }
    }));
  };

  const handleNotesChange = (e) => {
    setEditedPatient(prev => ({ ...prev, notes: e.target.value }));
  };

  const savePatientData = async () => {
    if (!editedPatient || !currentQueueEntry) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();

      // Update patient in Dexie
      const patientUpdate = {
        id: editedPatient.id,
        name: editedPatient.name,
        blood_group: editedPatient.blood_group,
        gender: editedPatient.gender,
        phone: editedPatient.phone,
        emergency_phone: editedPatient.emergency_phone,
        height: parseFloat(editedPatient.height) || null,
        weight: parseFloat(editedPatient.weight) || null,
        age: parseInt(editedPatient.age) || null,
        vitals: editedQueue?.vitals ?? editedPatient.vitals,
        notes: editedPatient.notes
      };

      await db.patients.update(editedPatient.id, patientUpdate);
      await enqueueOfflineAction('patients', 'UPDATE', patientUpdate);

      // Update queue vitals if changed
      if (editedQueue?.vitals) {
        const queueUpdate = { id: currentQueueEntry.id, vitals: editedQueue.vitals, updated_at: now };
        await db.queue.update(currentQueueEntry.id, queueUpdate);
        await enqueueOfflineAction('queue', 'UPDATE', queueUpdate);
      }
    } catch (err) {
      console.error('[DoctorDashboard] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const completeConsultation = async () => {
    if (!currentQueueEntry) return;
    const now = new Date().toISOString();
    const payload = { id: currentQueueEntry.id, status: 'Completed', updated_at: now };

    await db.queue.update(currentQueueEntry.id, payload);
    await enqueueOfflineAction('queue', 'UPDATE', payload);

    setCurrentQueueId(null);
  };

  const triageBadgeClass = (status) => {
    const s = status?.toLowerCase();
    if (s === 'red') return 'badge badge-red';
    if (s === 'yellow') return 'badge badge-yellow';
    return 'badge badge-green';
  };

  const triageBorderColor = (status) => {
    const s = status?.toLowerCase();
    if (s === 'red') return 'var(--triage-red-solid)';
    if (s === 'yellow') return 'var(--triage-yellow-solid)';
    return 'var(--triage-green-solid)';
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Doctor Dashboard Header */}
      <header className="glass-panel" style={{ borderRadius: '0 0 16px 16px', marginBottom: '24px' }}>
        <div className="container" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 15px rgba(13, 148, 136, 0.4)'
              }}>
                <Stethoscope size={26} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    ArogyaSync <span style={{ color: '#06b6d4', fontSize: '0.9rem', fontWeight: 600 }}>Doctor</span>
                  </h1>
                  <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Agent 2</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                  Real-time Consultation & Patient Management
                </p>
              </div>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                background: 'rgba(15, 23, 42, 0.6)', borderRadius: '20px',
                border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)'
              }}>
                <Users size={14} color="#06b6d4" />
                <span>Queue: <strong style={{ color: '#f8fafc' }}>{waitingQueue.length} waiting</strong></span>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                borderRadius: '10px', fontSize: '0.8rem',
                background: isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`,
                color: isOnline ? '#6ee7b7' : '#fca5a5'
              }}>
                {isOnline ? (
                  <>
                    <Wifi size={15} color="#10b981" />
                    <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    <span>Realtime Active</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={15} color="#ef4444" />
                    <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

          {/* ── Left: Patient Workspace ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {!currentQueueEntry || !editedPatient ? (
              <div className="glass-panel" style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '320px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <ClipboardList size={28} color="var(--primary)" />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center' }}>
                  No active patient. Select one from the queue on the right.
                </p>
              </div>
            ) : (
              <>
                {/* Patient Identity */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      <User size={18} color="#06b6d4" />
                      Patient Identity
                    </h2>
                    <span className={triageBadgeClass(currentQueueEntry.triage_status)}>
                      Triage: {currentQueueEntry.triage_status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    {[
                      { label: 'Full Name', field: 'name', type: 'text' },
                      { label: 'Blood Group', field: 'blood_group', type: 'text' },
                      { label: 'Gender', field: 'gender', type: 'text' },
                      { label: 'Phone Number', field: 'phone', type: 'text' },
                      { label: 'Emergency Phone', field: 'emergency_phone', type: 'text' }
                    ].map(({ label, field, type }) => (
                      <div key={field}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                        <input
                          type={type}
                          className="input-field"
                          name={field}
                          value={editedPatient?.[field] || ''}
                          onChange={handlePatientFieldChange}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        className="btn btn-primary"
                        onClick={savePatientData}
                        style={{ width: '100%' }}
                        disabled={isSaving}
                      >
                        <Save size={16} />
                        {isSaving ? 'Saving…' : 'Save Updates'}
                      </button>
                    </div>
                  </div>

                  {/* ASHA Critical Note */}
                  {currentQueueEntry.survival_info && (
                    <div style={{
                      marginTop: '16px', padding: '14px 16px',
                      background: 'var(--triage-red-bg)', border: '1px solid var(--triage-red-border)',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      <h4 style={{ color: 'var(--triage-red-text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <Activity size={15} /> Critical Intake Note from ASHA Worker
                      </h4>
                      <p style={{ color: '#f1f5f9', fontSize: '0.875rem', margin: 0 }}>{currentQueueEntry.survival_info}</p>
                    </div>
                  )}
                </div>

                {/* Vitals & Biometrics */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                    <Activity size={18} color="#06b6d4" />
                    Medical Vitals & Biometrics
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                    {[
                      { label: 'Height (cm)', field: 'height', type: 'number', src: 'patient' },
                      { label: 'Weight (kg)', field: 'weight', type: 'number', src: 'patient' },
                      { label: 'Age', field: 'age', type: 'number', src: 'patient' }
                    ].map(({ label, field, type }) => (
                      <div key={field}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                        <input
                          type={type}
                          className="input-field"
                          name={field}
                          value={editedPatient?.[field] || ''}
                          onChange={handlePatientFieldChange}
                        />
                      </div>
                    ))}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Heart Rate (bpm)</label>
                      <input
                        type="text"
                        className="input-field"
                        name="heartRate"
                        value={editedQueue?.vitals?.heartRate || ''}
                        onChange={handleVitalChange}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Blood Pressure</label>
                      <input
                        type="text"
                        className="input-field"
                        name="bp"
                        value={editedQueue?.vitals?.bp || ''}
                        onChange={handleVitalChange}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SpO2 (%)</label>
                      <input
                        type="text"
                        className="input-field"
                        name="spo2"
                        value={editedQueue?.vitals?.spo2 || ''}
                        onChange={handleVitalChange}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Temp (°F)</label>
                      <input
                        type="text"
                        className="input-field"
                        name="temp"
                        value={editedQueue?.vitals?.temp || ''}
                        onChange={handleVitalChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Clinical Notes */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                    <FileText size={18} color="#06b6d4" />
                    Documentation & Records
                  </h2>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Clinical Notes</label>
                    <textarea
                      className="input-field"
                      rows={5}
                      value={editedPatient?.notes || ''}
                      onChange={handleNotesChange}
                      placeholder="Enter clinical notes, prescriptions, follow-up instructions…"
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={completeConsultation}
                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}
                    >
                      <CheckCircle size={16} />
                      Mark Consultation Complete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Right: Incoming Queue Sidebar ── */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '60px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(13, 148, 136, 0.08)' }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#06b6d4" />
                Incoming Queue
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px', marginBottom: 0 }}>
                Live • Sorted by triage priority
              </p>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
              {waitingQueue.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0', fontSize: '0.85rem' }}>
                  Queue is clear.
                </p>
              ) : (
                waitingQueue.map((q, index) => {
                  const isActive = currentQueueId === q.id;
                  const p = patientMap[q.patient_id];
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQueueId(q.id)}
                      style={{
                        all: 'unset',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', borderRadius: 'var(--radius-md)',
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.2) 0%, rgba(6, 182, 212, 0.12) 100%)'
                          : 'rgba(15, 23, 42, 0.5)',
                        border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                        borderLeft: `3px solid ${triageBorderColor(q.triage_status)}`,
                        cursor: 'pointer', transition: 'all 0.2s ease', opacity: isActive ? 1 : 0.75
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '6px', color: 'var(--text-dim)' }}>
                            #{index + 1}
                          </span>
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {p?.name || 'Unknown'}
                          </h3>
                        </div>
                        <span className={triageBadgeClass(q.triage_status)} style={{ fontSize: '0.65rem' }}>
                          {q.triage_status}
                        </span>
                      </div>
                      <ChevronRight size={16} color="var(--text-dim)" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
