import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { enqueueOfflineAction } from '../lib/syncManager';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  User, Activity, FileText, History, ChevronRight, CheckCircle, Save,
  Stethoscope, Wifi, WifiOff, Users, X, BookOpen, ClipboardList, Radio
} from 'lucide-react';

const TRIAGE_PRIORITY = { Red: 1, Yellow: 2, Green: 3 };

export default function DoctorDashboard() {
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [isSaving, setIsSaving]               = useState(false);
  const [isOnline, setIsOnline]               = useState(navigator.onLine);
  const [activeTab, setActiveTab]             = useState('current'); // 'current' | 'history' | 'lora'
  const [viewingDoc, setViewingDoc]           = useState(null);
  const [editedPatient, setEditedPatient]     = useState({});
  const [editedVitals, setEditedVitals]       = useState({});
  const [radioPackets, setRadioPackets]       = useState(() => {
    const saved = localStorage.getItem('lora_logs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('lora_logs', JSON.stringify(radioPackets));
  }, [radioPackets]);

  useEffect(() => {
    const radioChannel = new BroadcastChannel('lora_radio');
    radioChannel.onmessage = (event) => {
      setRadioPackets(prev => {
        const isDuplicate = prev.some(p => p.id === event.data.id && p.ts === event.data.ts);
        if (isDuplicate) return prev;
        return [{ ...event.data, _receivedAt: new Date().toISOString() }, ...prev];
      });
    };
    return () => radioChannel.close();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const allVisits = useLiveQuery(() => {
    if (!db.visits) return [];
    return db.visits.toArray().catch(e => { console.error(e); return []; });
  }, []) || [];
  
  const patients = useLiveQuery(() => {
    if (!db.patients) return [];
    return db.patients.toArray().catch(e => { console.error(e); return []; });
  }, []) || [];
  
  const documents = useLiveQuery(() => {
    if (!db.documents) return [];
    return db.documents.toArray().catch(e => { console.error(e); return []; });
  }, []) || [];

  const patientMap = patients.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

  let activeQueue = allVisits.filter(v => ['Waiting', 'In Consultation', 'In Progress'].includes(v.status));
  activeQueue.sort((a, b) => {
    const pA = TRIAGE_PRIORITY[a.triage_status] ?? 4;
    const pB = TRIAGE_PRIORITY[b.triage_status] ?? 4;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const selectedVisit = allVisits.find(v => v.id === selectedVisitId);
  const currentPatient = selectedVisit ? patientMap[selectedVisit.patient_id] : null;
  const visitHistory = currentPatient
    ? allVisits.filter(v => v.patient_id === currentPatient.id && v.status === 'Completed')
    : [];
  const patientDocs = currentPatient
    ? documents.filter(d => d.patient_id === currentPatient.id)
    : [];

  useEffect(() => {
    if (selectedVisit && currentPatient) {
      setEditedPatient({
        name: currentPatient.name || '',
        blood_group: currentPatient.blood_group || '',
        gender: currentPatient.gender || '',
        phone: currentPatient.phone || '',
        emergency_phone: currentPatient.emergency_phone || ''
      });
      setEditedVitals(selectedVisit.vitals || {});
    } else {
      setEditedPatient({});
      setEditedVitals({});
    }
  }, [selectedVisitId, currentPatient?.id]);

  useEffect(() => {
    if (!selectedVisitId && activeQueue.length > 0) {
      setSelectedVisitId(activeQueue[0].id);
    }
  }, [activeQueue, selectedVisitId]);

  const handleStartConsultation = async () => {
    if (!selectedVisit) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    const updatePayload = { status: 'In Progress', updated_at: now, id: selectedVisit.id };
    await db.visits.update(selectedVisit.id, updatePayload);
    await enqueueOfflineAction('visits', 'UPDATE', updatePayload);
    setIsSaving(false);
  };

  const handlePatientField = (e) => setEditedPatient(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleVitalField = (e) => setEditedVitals(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSavePatientInfo = async () => {
    if (!currentPatient) return;
    setIsSaving(true);
    const update = { ...editedPatient, updated_at: new Date().toISOString() };
    await db.patients.update(currentPatient.id, update);
    await enqueueOfflineAction('patients', 'UPDATE', { id: currentPatient.id, ...update });
    setIsSaving(false);
  };

  const handleSaveVitals = async () => {
    if (!selectedVisit) return;
    setIsSaving(true);
    const update = { vitals: editedVitals, updated_at: new Date().toISOString() };
    await db.visits.update(selectedVisit.id, update);
    await enqueueOfflineAction('visits', 'UPDATE', { id: selectedVisit.id, ...update });
    setIsSaving(false);
  };

  const handleCompleteConsultation = async () => {
    if (!selectedVisit) return;
    const now = new Date().toISOString();
    const update = { status: 'Completed', updated_at: now };
    await db.visits.update(selectedVisit.id, update);
    await enqueueOfflineAction('visits', 'UPDATE', { id: selectedVisit.id, ...update });
    setSelectedVisitId(null);
  };

  const triageBadge = (level) => {
    if (level === 'Red') return 'badge badge-red';
    if (level === 'Yellow') return 'badge badge-yellow';
    return 'badge badge-green';
  };
  const triageBorder = (level) => {
    if (level === 'Red') return '#ef4444';
    if (level === 'Yellow') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: '#f8fafc', paddingBottom: '40px' }}>
      
      {/* ── HEADER ── */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '16px 24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--primary) 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stethoscope size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>Doctor Dashboard</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Consultation & Records System</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: isOnline ? '#10b981' : '#ef4444' }}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span style={{ fontWeight: 600 }}>{isOnline ? 'Online Synced' : 'Offline Mode'}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <main className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* ── LEFT PANE ── */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Tab Navigation (Always Visible) */}
          <div style={{ display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'rgba(15,23,42,0.6)' }}>
            {[
              { key: 'current', label: 'Current Consultation', icon: <Stethoscope size={14} /> },
              { key: 'history', label: `History (${visitHistory.length})`, icon: <History size={14} /> },
              { key: 'lora',    label: `Radio Receiver (${radioPackets.length})`, icon: <Radio size={14} /> }
            ].map(({ key, label, icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: activeTab === key ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: activeTab === key ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: '0.85rem'
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div style={{ flex: 1 }}>
            {activeTab === 'lora' ? (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '0.9rem', color: '#10b981', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={16} color="#10b981" /> Incoming LoRa Transmissions
                  </h2>
                  <button onClick={() => { setRadioPackets([]); localStorage.removeItem('lora_logs'); }} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    Clear Log
                  </button>
                </div>

                <div style={{ flex: 1, background: '#020617', borderRadius: '12px', border: '1px solid #1e293b', padding: '16px', overflowY: 'auto', maxHeight: '500px', fontFamily: 'monospace' }}>
                  {radioPackets.length === 0 ? (
                    <div style={{ color: '#334155', textAlign: 'center', padding: '40px 0' }}>
                      <Radio size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                      <p style={{ margin: 0 }}>Listening on 868 MHz...</p>
                      <p style={{ fontSize: '0.75rem', marginTop: '8px' }}>Waiting for ASHA transmission.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {radioPackets.map((pkt, idx) => (
                        <div key={idx} style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#10b981', fontSize: '0.75rem' }}>
                            <span>[RX] {new Date(pkt._receivedAt).toLocaleTimeString()}</span>
                            <span>Signal: -84 dBm</span>
                          </div>
                          <pre style={{ margin: 0, color: '#f8fafc', fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {JSON.stringify(pkt, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (!selectedVisit || !currentPatient) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-dim)' }}>
                <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <h3>No Active Patient</h3>
                <p>Select a patient from the queue to begin consultation.</p>
              </div>
            ) : (
              <>
                {activeTab === 'current' && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {selectedVisit.status === 'In Consultation' && (
                      <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', color: '#60a5fa', fontSize: '1rem' }}>Patient is Waiting</h3>
                          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Review the details below and start the consultation when ready.</p>
                        </div>
                        <button className="btn btn-primary" onClick={handleStartConsultation} disabled={isSaving} style={{ background: '#3b82f6', padding: '12px 24px', fontWeight: 'bold' }}>
                          Start Consultation
                        </button>
                      </div>
                    )}

                    <div className="glass-panel" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={16} color="#06b6d4" /> Patient Identity
                        </h2>
                        <span className={triageBadge(selectedVisit.triage_status)}>
                          Triage: {selectedVisit.triage_status}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {[{ label: 'Full Name', name: 'name' }, { label: 'Blood Group', name: 'blood_group' }, { label: 'Gender', name: 'gender' }, { label: 'Phone', name: 'phone' }].map(({ label, name }) => (
                          <div key={name}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                            <input type="text" className="input-field" name={name} value={editedPatient[name] || ''} onChange={handlePatientField} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button className="btn btn-secondary" onClick={handleSavePatientInfo} disabled={isSaving}>
                          <Save size={14} /> {isSaving ? 'Saving...' : 'Save Info'}
                        </button>
                      </div>
                      {selectedVisit.survival_info && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--triage-red-bg)', border: '1px solid var(--triage-red-border)', borderRadius: '8px' }}>
                          <h4 style={{ color: 'var(--triage-red-text)', margin: '0 0 6px', fontSize: '0.85rem' }}>Critical ASHA Note:</h4>
                          <p style={{ color: '#fff', margin: 0, fontSize: '0.9rem' }}>{selectedVisit.survival_info}</p>
                        </div>
                      )}
                    </div>

                    <div className="glass-panel" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Activity size={16} color="#10b981" /> Current Vitals
                        </h2>
                        <button className="btn btn-primary" onClick={handleSaveVitals} disabled={isSaving} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          <Save size={14} /> {isSaving ? 'Saving...' : 'Update Vitals'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                        {[{ label: 'Heart Rate', name: 'heartRate' }, { label: 'BP', name: 'bp' }, { label: 'SpO2 (%)', name: 'spo2' }, { label: 'Temp (°F)', name: 'temp' }].map(({ label, name }) => (
                          <div key={name}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                            <input type="text" className="input-field" name={name} value={editedVitals[name] || ''} onChange={handleVitalField} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BookOpen size={16} color="#3b82f6" /> Attached Documents ({patientDocs.length})
                        </h2>
                      </div>
                      {patientDocs.length === 0 ? (
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>No documents uploaded by ASHA.</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {patientDocs.map(doc => (
                            <button key={doc.id} onClick={() => setViewingDoc(doc)}
                              style={{ padding: '12px', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
                            >
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={14} /> {doc.document_type}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(doc.uploaded_at).toLocaleString()}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', gap: '12px' }}>
                      {selectedVisit.status !== 'In Consultation' && (
                        <button className="btn btn-primary" onClick={handleCompleteConsultation} disabled={isSaving} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '12px 24px' }}>
                          <CheckCircle size={18} /> Mark Consultation Complete
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div style={{ padding: '24px' }}>
                    <h2 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px' }}>
                      Past Records — {currentPatient.name}
                    </h2>
                    {visitHistory.length === 0 ? (
                      <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>No previous visits recorded.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {visitHistory.map(v => (
                          <div key={v.id} className="glass-panel" style={{ padding: '16px', borderLeft: `4px solid ${triageBorder(v.triage_status)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <strong style={{ color: '#fff' }}>{new Date(v.created_at).toLocaleDateString()}</strong>
                              <span className={triageBadge(v.triage_status)}>{v.triage_status}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              Complaint: <span style={{ color: '#fff' }}>{v.chief_complaint || 'None specified'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANE: Queue Sidebar ── */}
        <div className="glass-panel" style={{ padding: 0, position: 'sticky', top: '80px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(13,148,136,0.1)' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={16} color="#06b6d4" /> Active Queue ({activeQueue.length})
            </h2>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '75vh', overflowY: 'auto' }}>
            {activeQueue.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>Queue is clear.</p>
            ) : (
              activeQueue.map((v, idx) => {
                const isActive = selectedVisitId === v.id;
                const p = patientMap[v.patient_id];
                return (
                  <button key={v.id} onClick={() => setSelectedVisitId(v.id)}
                    style={{
                      all: 'unset', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px', borderRadius: '8px', cursor: 'pointer',
                      background: isActive ? 'linear-gradient(135deg, rgba(13,148,136,0.2) 0%, rgba(6,182,212,0.1) 100%)' : 'rgba(15,23,42,0.5)',
                      border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                      borderLeft: `3px solid ${triageBorder(v.triage_status)}`,
                      opacity: isActive ? 1 : 0.8
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '4px' }}>
                        #{idx + 1} {p?.name || 'Unknown'}
                      </div>
                      <span className={triageBadge(v.triage_status)} style={{ fontSize: '0.65rem' }}>{v.triage_status}</span>
                    </div>
                    <ChevronRight size={14} color="var(--text-dim)" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ── Document Viewer Modal ── */}
      {viewingDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.8)' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#06b6d4" />
                {viewingDoc.document_type} — {currentPatient?.name}
              </h3>
              <button onClick={() => setViewingDoc(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ flex: 1, background: '#e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', position: 'relative' }}>
              {viewingDoc.file_url?.startsWith('data:image/') ? (
                <img src={viewingDoc.file_url} alt="Medical Document" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <embed src={viewingDoc.file_url} type="application/pdf" style={{ width: '100%', height: '100%', border: 'none' }} />
                  <div style={{ position: 'absolute', bottom: '20px', background: 'rgba(0,0,0,0.8)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: '#fff', margin: '0 0 8px' }}>If the document is blank, your browser blocked the PDF preview.</p>
                    <a href={viewingDoc.file_url} download={`${currentPatient?.name}_${viewingDoc.document_type}`} className="btn btn-primary" style={{ padding: '8px 16px', textDecoration: 'none', display: 'inline-block' }}>
                      Download PDF to View
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 24px', background: 'rgba(15,23,42,0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Uploaded on {new Date(viewingDoc.uploaded_at).toLocaleString()}
              </span>
              <a href={viewingDoc.file_url} download={`${currentPatient?.name}_${viewingDoc.document_type}`} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem', textDecoration: 'none' }}>
                Download Original
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
