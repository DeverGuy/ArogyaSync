import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, Activity, FileText, ChevronRight, CheckCircle, Save } from 'lucide-react';

const DoctorDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchQueue();

    // Subscribe to realtime queue updates
    const subscription = supabase
      .channel('doctor_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchQueue = async () => {
    const { data, error } = await supabase
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
      // Sort: Red > Yellow > Green
      const sorted = [...data].sort((a, b) => {
        const priority = { 'Red': 3, 'Yellow': 2, 'Green': 1 };
        return priority[b.triage_status] - priority[a.triage_status];
      });
      
      const waiting = sorted.filter(q => q.status === 'Waiting');
      setQueue(waiting);

      // If no current patient and queue has waiting, set the top as current
      if (!currentPatient && waiting.length > 0) {
        selectPatient(waiting[0]);
      }
    }
  };

  const selectPatient = (queueItem) => {
    setCurrentPatient(queueItem);
  };

  const handlePatientUpdate = (e) => {
    const { name, value } = e.target;
    setCurrentPatient(prev => {
      // Handle vitals separately (nested JSON)
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
    setIsSaving(true);
    const { error } = await supabase
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
    
    // Update queue status to completed
    await supabase
      .from('queue')
      .update({ status: 'Completed' })
      .eq('id', currentPatient.id);
      
    setCurrentPatient(null);
    fetchQueue(); // Trigger fetch for the next patient
  };

  return (
    <div className="doctor-dashboard">
      
      {/* Main Panel - Current Patient */}
      <div className="main-panel">
        {!currentPatient ? (
          <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No active patient. Select from queue.</p>
          </div>
        ) : (
          <>
            {/* Persistent Header */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="panel-title" style={{ margin: 0, borderBottom: 'none' }}>
                  <User size={18} style={{marginRight: 8, display:'inline'}}/> Patient Identity
                </h2>
                <div>
                  <span className={`badge badge-${currentPatient.triage_status.toLowerCase()}`}>
                    Triage: {currentPatient.triage_status}
                  </span>
                </div>
              </div>
              
              <div className="grid-3">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" className="form-input" name="name" value={currentPatient.patients.name || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Blood Group</label>
                  <input type="text" className="form-input" name="blood_group" value={currentPatient.patients.blood_group || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <input type="text" className="form-input" name="gender" value={currentPatient.patients.gender || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="form-input" name="phone" value={currentPatient.patients.phone || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Emergency Phone</label>
                  <input type="text" className="form-input" name="emergency_phone" value={currentPatient.patients.emergency_phone || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn" onClick={savePatientData} style={{ width: '100%' }}>
                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save Updates'}
                  </button>
                </div>
              </div>
              {currentPatient.survival_info && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-color)', borderRadius: '4px' }}>
                  <h4 style={{ color: 'var(--danger-color)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={16} /> Critical Intake Note from PHC
                  </h4>
                  <p style={{ color: '#fff', fontSize: '0.875rem' }}>{currentPatient.survival_info}</p>
                </div>
              )}
            </div>

            {/* Previous Visit Vitals */}
            <div className="panel">
              <h2 className="panel-title"><Activity size={18} style={{marginRight: 8, display:'inline'}}/> Medical Vitals & Biometrics</h2>
              <div className="grid-3">
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input type="number" className="form-input" name="height" value={currentPatient.patients.height || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" className="form-input" name="weight" value={currentPatient.patients.weight || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input type="number" className="form-input" name="age" value={currentPatient.patients.age || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Heart Rate (bpm)</label>
                  <input type="text" className="form-input" name="hr" value={currentPatient.patients.vitals?.hr || ''} onChange={handlePatientUpdate} />
                </div>
                <div className="form-group">
                  <label>Blood Pressure</label>
                  <input type="text" className="form-input" name="bp" value={currentPatient.patients.vitals?.bp || ''} onChange={handlePatientUpdate} />
                </div>
              </div>
            </div>

            {/* Documentation Section */}
            <div className="panel" style={{ flex: 1 }}>
              <h2 className="panel-title"><FileText size={18} style={{marginRight: 8, display:'inline'}}/> Documentation & Records</h2>
              <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label>Clinical Notes</label>
                <textarea 
                  className="form-textarea" 
                  name="notes" 
                  value={currentPatient.patients.notes || ''} 
                  onChange={handlePatientUpdate}
                  style={{ flex: 1, minHeight: '100px', resize: 'none' }}
                  placeholder="Enter clinical notes, prescriptions, etc."
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-success" onClick={completeConsultation}>
                  <CheckCircle size={16} /> Mark Consultation Complete
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Sidebar - Queue */}
      <div className="queue-sidebar">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
          <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Incoming Queue</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live Sync Active</p>
        </div>
        <div style={{ overflowY: 'auto', padding: '1rem', flex: 1 }}>
          {queue.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Queue clear.</p>
          ) : (
            queue.map((q, index) => (
              <div 
                key={q.id} 
                className={`patient-card severity-${q.triage_status.toLowerCase()}`}
                style={{ 
                  cursor: 'pointer', 
                  opacity: currentPatient?.id === q.id ? 1 : 0.7,
                  border: currentPatient?.id === q.id ? '2px solid var(--accent-color)' : ''
                }}
                onClick={() => selectPatient(q)}
              >
                <div className="patient-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>#{index + 1}</span>
                    <h3 style={{ margin: 0, fontSize: '0.875rem' }}>{q.patients?.name || 'Unknown'}</h3>
                  </div>
                  <span className={`badge badge-${q.triage_status.toLowerCase()}`}>{q.triage_status}</span>
                </div>
                <ChevronRight size={16} color="var(--text-secondary)" />
              </div>
            ))
          )}
        </div>
      </div>
      
    </div>
  );
};

export default DoctorDashboard;
