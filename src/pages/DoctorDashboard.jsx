import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { enqueueOfflineAction } from '../lib/syncManager';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  User, Activity, FileText, History, ChevronRight, CheckCircle, Save,
  Stethoscope, Wifi, WifiOff, Users, X, BookOpen, ClipboardList, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    if (level === 'Red') return 'bg-[#FDEBEC] border-[#FDEBEC] text-[#9F2F2D]';
    if (level === 'Yellow') return 'bg-[#FBF3DB] border-[#FBF3DB] text-[#956400]';
    return 'bg-[#EDF3EC] border-[#EDF3EC] text-[#346538]';
  };
  const triageBorder = (level) => {
    if (level === 'Red') return 'border-[#9F2F2D]';
    if (level === 'Yellow') return 'border-[#956400]';
    return 'border-[#346538]';
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F6F3] text-[#111111] pb-10">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-[#EAEAEA] mb-12 py-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-[#EAEAEA] rounded-md flex items-center justify-center bg-[#FBFBFA]">
              <Stethoscope size={20} className="text-[#111111]" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-medium tracking-tight text-[#111111] m-0 leading-none">Doctor Dashboard</h1>
              <p className="text-sm text-[#787774] mt-1 leading-none">Consultation & Records System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest ${isOnline ? 'bg-[#EDF3EC] border-[#EDF3EC] text-[#346538]' : 'bg-[#FDEBEC] border-[#FDEBEC] text-[#9F2F2D]'}`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? 'Online Synced' : 'Offline Mode'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-[1400px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
        
        {/* LEFT PANE */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden min-h-[600px] flex flex-col shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          
          {/* Tabs */}
          <div className="flex gap-4 p-4 border-b border-[#EAEAEA] bg-[#FBFBFA] overflow-x-auto no-scrollbar">
            {[
              { key: 'current', label: 'Current Consultation', icon: <Stethoscope size={14} /> },
              { key: 'history', label: `History (${visitHistory.length})`, icon: <History size={14} /> },
              { key: 'lora',    label: `Radio Receiver (${radioPackets.length})`, icon: <Radio size={14} /> }
            ].map(({ key, label, icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === key ? 'bg-[#111111] text-white' : 'text-[#787774] hover:bg-[#F7F6F3] hover:text-[#111111]'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="h-full flex flex-col"
              >
                {activeTab === 'lora' ? (
                  <div className="p-8 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-sm font-bold text-[#111111] uppercase tracking-widest flex items-center gap-2">
                        <Radio size={16} /> Incoming LoRa Transmissions
                      </h2>
                      <button 
                        onClick={() => { setRadioPackets([]); localStorage.removeItem('lora_logs'); }}
                        className="btn-minimal-outline text-xs"
                      >
                        Clear Log
                      </button>
                    </div>

                    <div className="flex-1 bg-[#FBFBFA] border border-[#EAEAEA] rounded-md p-6 overflow-y-auto max-h-[500px] font-mono text-sm shadow-inner">
                      {radioPackets.length === 0 ? (
                        <div className="text-[#787774] text-center py-16 flex flex-col items-center">
                          <Radio size={32} className="opacity-50 mb-4" />
                          <p>Listening on 868 MHz...</p>
                          <p className="mt-2 text-xs">Waiting for ASHA transmission.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {radioPackets.map((pkt, idx) => (
                            <div key={idx} className="p-4 bg-white border border-[#EAEAEA] rounded-md shadow-sm">
                              <div className="flex justify-between text-xs text-[#787774] font-bold mb-3 uppercase tracking-widest border-b border-[#EAEAEA] pb-2">
                                <span>[RX] {new Date(pkt._receivedAt).toLocaleTimeString()}</span>
                                <span>Signal: -84 dBm</span>
                              </div>
                              <pre className="text-[#111111] whitespace-pre-wrap break-all text-xs">
                                {JSON.stringify(pkt, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (!selectedVisit || !currentPatient) ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-[#787774]">
                    <Users size={48} className="mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-[#111111]">No Active Patient</h3>
                    <p className="text-sm">Select a patient from the queue to begin consultation.</p>
                  </div>
                ) : (
                  <>
                    {activeTab === 'current' && (
                      <div className="p-8 flex flex-col gap-8">
                        {selectedVisit.status === 'In Consultation' && (
                          <div className="p-5 bg-[#F9F9F8] border border-[#EAEAEA] rounded-xl flex justify-between items-center">
                            <div>
                              <h3 className="text-[#111111] font-bold mb-1">Patient is Waiting</h3>
                              <p className="text-[#787774] text-sm">Review the details below and start the consultation when ready.</p>
                            </div>
                            <button 
                              onClick={handleStartConsultation} 
                              disabled={isSaving}
                              className="btn-minimal"
                            >
                              Start Consultation
                            </button>
                          </div>
                        )}

                        <div className="bento-card relative overflow-hidden">
                          <div className="flex justify-between items-center mb-8 border-b border-[#EAEAEA] pb-4">
                            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-widest flex items-center gap-2">
                              <User size={16} className="text-[#787774]" /> Patient Identity
                            </h2>
                            <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${triageBadge(selectedVisit.triage_status)}`}>
                              Triage: {selectedVisit.triage_status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                              { label: 'Full Name', name: 'name' }, 
                              { label: 'Blood Group', name: 'blood_group' }, 
                              { label: 'Gender', name: 'gender' }, 
                              { label: 'Phone', name: 'phone' }
                            ].map(({ label, name }) => (
                              <div key={name} className="space-y-2">
                                <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">{label}</label>
                                <input 
                                  type="text" 
                                  name={name} 
                                  value={editedPatient[name] || ''} 
                                  onChange={handlePatientField}
                                  className="minimal-input"
                                />
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex justify-end mt-8 border-t border-[#EAEAEA] pt-6">
                            <button 
                              onClick={handleSavePatientInfo} 
                              disabled={isSaving}
                              className="btn-minimal flex items-center gap-2"
                            >
                              <Save size={14} /> {isSaving ? 'Saving...' : 'Save Info'}
                            </button>
                          </div>

                          {selectedVisit.survival_info && (
                            <div className="mt-6 p-5 bg-[#FDEBEC] border border-[#FDEBEC] rounded-md">
                              <h4 className="text-[#9F2F2D] font-bold text-xs uppercase tracking-widest mb-2">Critical ASHA Note</h4>
                              <p className="text-[#9F2F2D] text-sm leading-relaxed">{selectedVisit.survival_info}</p>
                            </div>
                          )}
                        </div>

                        <div className="bento-card">
                          <div className="flex justify-between items-center mb-8 border-b border-[#EAEAEA] pb-4">
                            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-widest flex items-center gap-2">
                              <Activity size={16} className="text-[#787774]" /> Current Vitals
                            </h2>
                            <button 
                              onClick={handleSaveVitals} 
                              disabled={isSaving}
                              className="btn-minimal-outline flex items-center gap-2 text-xs py-1.5"
                            >
                              <Save size={14} /> {isSaving ? 'Saving...' : 'Update Vitals'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                              { label: 'Heart Rate', name: 'heartRate' }, 
                              { label: 'BP', name: 'bp' }, 
                              { label: 'SpO2 (%)', name: 'spo2' }, 
                              { label: 'Temp (°F)', name: 'temp' }
                            ].map(({ label, name }) => (
                              <div key={name} className="space-y-2">
                                <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">{label}</label>
                                <input 
                                  type="text" 
                                  name={name} 
                                  value={editedVitals[name] || ''} 
                                  onChange={handleVitalField}
                                  className="minimal-input text-center font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bento-card">
                          <div className="flex justify-between items-center mb-6 border-b border-[#EAEAEA] pb-4">
                            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-widest flex items-center gap-2">
                              <BookOpen size={16} className="text-[#787774]" /> Attached Documents ({patientDocs.length})
                            </h2>
                          </div>
                          {patientDocs.length === 0 ? (
                            <p className="text-[#787774] text-sm">No documents uploaded by ASHA.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {patientDocs.map(doc => (
                                <button 
                                  key={doc.id} 
                                  onClick={() => setViewingDoc(doc)}
                                  className="flex flex-col gap-2 p-4 bg-[#FBFBFA] hover:bg-[#F9F9F8] border border-[#EAEAEA] rounded-md text-left transition-colors"
                                >
                                  <span className="text-sm font-medium text-[#111111] flex items-center gap-2">
                                    <FileText size={16} className="text-[#787774]" /> {doc.document_type}
                                  </span>
                                  <span className="text-xs text-[#787774] font-mono">
                                    {new Date(doc.uploaded_at).toLocaleString()}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end mt-4">
                          {selectedVisit.status === 'In Progress' && (
                            <button 
                              onClick={handleCompleteConsultation} 
                              disabled={isSaving}
                              className="btn-minimal flex items-center gap-2 px-8 py-3 bg-[#346538] hover:bg-[#284f2c]"
                            >
                              <CheckCircle size={18} /> Mark Consultation Complete
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'history' && (
                      <div className="p-8">
                        <h2 className="text-sm font-bold text-[#787774] uppercase tracking-widest mb-8 border-b border-[#EAEAEA] pb-4">
                          Past Records — {currentPatient.name}
                        </h2>
                        {visitHistory.length === 0 ? (
                          <p className="text-[#787774] text-center py-16 text-sm">No previous visits recorded.</p>
                        ) : (
                          <div className="flex flex-col gap-6">
                            {visitHistory.map(v => (
                              <div key={v.id} className={`bg-[#FBFBFA] p-6 rounded-md border border-[#EAEAEA] border-l-4 ${triageBorder(v.triage_status)}`}>
                                <div className="flex justify-between items-start mb-4">
                                  <strong className="text-[#111111] font-mono text-sm">{new Date(v.created_at).toLocaleDateString()}</strong>
                                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${triageBadge(v.triage_status)}`}>
                                    {v.triage_status}
                                  </span>
                                </div>
                                <div className="text-sm text-[#787774]">
                                  <span className="block text-xs font-bold uppercase tracking-widest mb-1">Complaint</span>
                                  <span className="text-[#111111]">{v.chief_complaint || 'None specified'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT PANE: Queue Sidebar */}
        <div className="bg-white border border-[#EAEAEA] rounded-xl sticky top-[100px] overflow-hidden flex flex-col max-h-[calc(100vh-140px)] shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-[#EAEAEA] bg-[#F9F9F8]">
            <h2 className="text-xs font-bold text-[#111111] uppercase tracking-widest flex items-center gap-2">
              <ClipboardList size={14} className="text-[#787774]" /> Active Queue ({activeQueue.length})
            </h2>
          </div>
          <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1 no-scrollbar bg-[#FBFBFA]">
            {activeQueue.length === 0 ? (
              <p className="text-[#787774] text-center py-16 text-sm">Queue is clear.</p>
            ) : (
              activeQueue.map((v, idx) => {
                const isActive = selectedVisitId === v.id;
                const p = patientMap[v.patient_id];
                return (
                  <button key={v.id} onClick={() => setSelectedVisitId(v.id)}
                    className={`flex justify-between items-center p-4 rounded-md text-left transition-all border ${
                      isActive 
                        ? 'bg-white border-[#111111] shadow-sm' 
                        : 'bg-white border-[#EAEAEA] hover:border-[#D4D4D4]'
                    } border-l-4 ${triageBorder(v.triage_status)}`}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#111111] mb-2">
                        #{idx + 1} {p?.name || 'Unknown'}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${triageBadge(v.triage_status)}`}>
                        {v.triage_status}
                      </span>
                    </div>
                    <ChevronRight size={14} className={isActive ? 'text-[#111111]' : 'text-[#D4D4D4]'} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {viewingDoc && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-6 sm:p-12"
          >
            <motion.div 
              initial={{ scale: 0.98, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white border border-[#EAEAEA] rounded-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.05)]"
            >
              <div className="p-6 border-b border-[#EAEAEA] flex justify-between items-center bg-[#FBFBFA]">
                <h3 className="text-[#111111] font-bold flex items-center gap-3 m-0">
                  <FileText size={18} className="text-[#787774]" />
                  {viewingDoc.document_type} — {currentPatient?.name}
                </h3>
                <button onClick={() => setViewingDoc(null)} className="text-[#787774] hover:text-[#111111] p-2 bg-white border border-[#EAEAEA] rounded-md transition-colors">
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex-1 bg-[#F7F6F3] flex items-center justify-center relative overflow-auto p-6">
                {viewingDoc.file_url?.startsWith('data:image/') ? (
                  <img src={viewingDoc.file_url} alt="Medical Document" className="max-w-full max-h-full object-contain rounded-md shadow-sm border border-[#EAEAEA]" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <embed src={viewingDoc.file_url} type="application/pdf" className="w-full h-full rounded-md shadow-sm border border-[#EAEAEA]" />
                    <div className="absolute bottom-8 bg-white p-6 rounded-xl text-center border border-[#EAEAEA] shadow-lg max-w-sm">
                      <p className="text-[#787774] text-sm mb-4">If the document is blank, your browser blocked the PDF preview.</p>
                      <a 
                        href={viewingDoc.file_url} 
                        download={`${currentPatient?.name}_${viewingDoc.document_type}`} 
                        className="btn-minimal inline-block w-full"
                      >
                        Download PDF to View
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-white border-t border-[#EAEAEA] flex justify-between items-center">
                <span className="text-xs font-mono text-[#787774]">
                  Uploaded on {new Date(viewingDoc.uploaded_at).toLocaleString()}
                </span>
                <a 
                  href={viewingDoc.file_url} 
                  download={`${currentPatient?.name}_${viewingDoc.document_type}`} 
                  className="btn-minimal-outline"
                >
                  Download Original
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
