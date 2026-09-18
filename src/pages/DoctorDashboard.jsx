import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
 * Provides real-time patient consultation view for doctors.
 * The queue sidebar auto-updates via Supabase Realtime on the `queue` table.
 * The doctor selects a patient from the queue, reviews/updates vitals, writes
 * clinical notes, and marks the consultation complete.
 *
 * Data schema: `queue` + `patients` tables (Moksh's schema).
 * NOTE: Data-flow reconciliation with ASHA dashboard is a future task.
 */
export default function DoctorDashboard() {
  const [queue, setQueue] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    fetchQueue();

    // Track real network connectivity
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to realtime queue updates via Supabase
    const subscription = supabase
      .channel('doctor_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('queue')
      .select(`
        id,
        triage_status,
        status,
        survival_info,
        patient_id,
        patients (*)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      const priority = { Red: 3, Yellow: 2, Green: 1 };
      const sorted = [...data].sort(
        (a, b) => (priority[b.triage_status] ?? 0) - (priority[a.triage_status] ?? 0)
      );
      const waiting = sorted.filter(q => q.status === 'Waiting');
      setQueue(waiting);

      // Auto-select first patient if no current patient is set
      setCurrentPatient(prev => {
        if (!prev && waiting.length > 0) return waiting[0];
        return prev;
      });
    }
  };

  const handlePatientUpdate = (e) => {
    const { name, value } = e.target;
    setCurrentPatient(prev => {
      if (name === 'hr' || name === 'bp') {
        return {
          ...prev,
          patients: {
            ...prev.patients,
            vitals: {
              ...(prev.patients.vitals || {}),
              [name]: value
            }
          }
        };
      }
      return {
        ...prev,
        patients: { ...prev.patients, [name]: value }
      };
    });
  };

  const savePatientData = async () => {
    if (!currentPatient) return;
    setIsSaving(true);
    await supabase
      .from('patients')
      .update({
        name: currentPatient.patients.name,
        blood_group: currentPatient.patients.blood_group,
        gender: currentPatient.patients.gender,
        phone: currentPatient.patients.phone,
        emergency_phone: currentPatient.patients.emergency_phone,
        height: parseFloat(currentPatient.patients.height) || null,
        weight: parseFloat(currentPatient.patients.weight) || null,
        age: parseInt(currentPatient.patients.age) || null,
        vitals: currentPatient.patients.vitals,
        notes: currentPatient.patients.notes
      })
      .eq('id', currentPatient.patient_id);
    setIsSaving(false);
  };

  const completeConsultation = async () => {
    if (!currentPatient) return;
    await supabase
      .from('queue')
      .update({ status: 'Completed' })
      .eq('id', currentPatient.id);
    setCurrentPatient(null);
    fetchQueue();
  };

  const triageBadgeStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === 'red') return { className: 'badge badge-red' };
    if (s === 'yellow') return { className: 'badge badge-yellow' };
    return { className: 'badge badge-green' };
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

            {/* Logo & Platform Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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

            {/* Status Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

              {/* Queue Count Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                <Users size={14} color="#06b6d4" />
                <span>Queue: <strong style={{ color: '#f8fafc' }}>{queue.length} waiting</strong></span>
              </div>

              {/* Connectivity Indicator (read-only for Doctor — uses real network state) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '0.8rem',
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

      {/* Main Layout: Content + Queue Sidebar */}
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

          {/* ─── Left: Current Patient Workspace ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {!currentPatient ? (
              <div className="glass-panel" style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '320px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(13, 148, 136, 0.1)',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ClipboardList size={28} color="var(--primary)" />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center' }}>
                  No active patient. Select one from the queue on the right.
                </p>
              </div>
            ) : (
              <>
                {/* Patient Identity Card */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      <User size={18} color="#06b6d4" />
                      Patient Identity
                    </h2>
                    <span className={triageBadgeStyle(currentPatient.triage_status).className}>
                      Triage: {currentPatient.triage_status}
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
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          {label}
                        </label>
                        <input
                          type={type}
                          className="input-field"
                          name={field}
                          value={currentPatient.patients?.[field] || ''}
                          onChange={handlePatientUpdate}
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

                  {/* Critical Intake Note */}
                  {currentPatient.survival_info && (
                    <div style={{
                      marginTop: '16px',
                      padding: '14px 16px',
                      background: 'var(--triage-red-bg)',
                      border: '1px solid var(--triage-red-border)',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      <h4 style={{ color: 'var(--triage-red-text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <Activity size={15} />
                        Critical Intake Note from ASHA Worker
                      </h4>
                      <p style={{ color: '#f1f5f9', fontSize: '0.875rem', margin: 0 }}>{currentPatient.survival_info}</p>
                    </div>
                  )}
                </div>

                {/* Medical Vitals & Biometrics */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                    <Activity size={18} color="#06b6d4" />
                    Medical Vitals & Biometrics
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                    {[
                      { label: 'Height (cm)', field: 'height', type: 'number' },
                      { label: 'Weight (kg)', field: 'weight', type: 'number' },
                      { label: 'Age', field: 'age', type: 'number' }
                    ].map(({ label, field, type }) => (
                      <div key={field}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                        <input
                          type={type}
                          className="input-field"
                          name={field}
                          value={currentPatient.patients?.[field] || ''}
                          onChange={handlePatientUpdate}
                        />
                      </div>
                    ))}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Heart Rate (bpm)</label>
                      <input
                        type="text"
                        className="input-field"
                        name="hr"
                        value={currentPatient.patients?.vitals?.hr || ''}
                        onChange={handlePatientUpdate}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Blood Pressure</label>
                      <input
                        type="text"
                        className="input-field"
                        name="bp"
                        value={currentPatient.patients?.vitals?.bp || ''}
                        onChange={handlePatientUpdate}
                      />
                    </div>
                  </div>
                </div>

                {/* Documentation & Clinical Notes */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                    <FileText size={18} color="#06b6d4" />
                    Documentation & Records
                  </h2>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Clinical Notes</label>
                    <textarea
                      className="input-field"
                      name="notes"
                      rows={5}
                      value={currentPatient.patients?.notes || ''}
                      onChange={handlePatientUpdate}
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

          {/* ─── Right: Incoming Queue Sidebar ─── */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '24px' }}>
            {/* Sidebar Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(13, 148, 136, 0.08)'
            }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#06b6d4" />
                Incoming Queue
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px', marginBottom: 0 }}>
                Realtime • Sorted by triage priority
              </p>
            </div>

            {/* Patient Cards */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
              {queue.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0', fontSize: '0.85rem' }}>
                  Queue is clear.
                </p>
              ) : (
                queue.map((q, index) => {
                  const isActive = currentPatient?.id === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentPatient(q)}
                      style={{
                        all: 'unset',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.2) 0%, rgba(6, 182, 212, 0.12) 100%)'
                          : 'rgba(15, 23, 42, 0.5)',
                        border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                        borderLeft: `3px solid ${triageBorderColor(q.triage_status)}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isActive ? 1 : 0.75
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '6px', color: 'var(--text-dim)' }}>
                            #{index + 1}
                          </span>
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {q.patients?.name || 'Unknown'}
                          </h3>
                        </div>
                        <span className={triageBadgeStyle(q.triage_status).className} style={{ fontSize: '0.65rem' }}>
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
