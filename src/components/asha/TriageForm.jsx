import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import { AlertCircle, CheckCircle2, UserPlus, HeartPulse, ShieldAlert, ArrowRight } from 'lucide-react';

export function TriageForm({ onTriageComplete, isOnline }) {
  const existingPatients = useLiveQuery(() => db.patients.toArray(), []) || [];

  const [mode, setMode] = useState('new'); // 'new' or 'existing'
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Patient Info Form State
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Triage & Vitals Form State
  const [triageStatus, setTriageStatus] = useState('RED'); // Default to RED for high safety
  const [age, setAge] = useState('45');
  const [height, setHeight] = useState('168');
  const [weight, setWeight] = useState('65');
  
  const [bp, setBp] = useState('130/85');
  const [spo2, setSpo2] = useState('95');
  const [heartRate, setHeartRate] = useState('88');
  const [temp, setTemp] = useState('98.6');

  const [ashaInstructions, setAshaInstructions] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSelectExisting = (patientId) => {
    setSelectedPatientId(patientId);
    const p = existingPatients.find((item) => item.id === patientId);
    if (p) {
      setFullName(p.name);
      setGender(p.gender);
      setBloodGroup(p.blood_group);
      setPhoneNumber(p.phone);
      setEmergencyPhone(p.emergency_phone);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Please enter patient full name');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      let patientId = selectedPatientId;
      const now = new Date().toISOString();

      // 1. Create Patient if new — fields aligned with Supabase patients table
      if (mode === 'new' || !patientId) {
        patientId = generateUUID();
        const qrHash = `AROGYA-${patientId.slice(0, 8)}-${bloodGroup}`;
        const newPatient = {
          id: patientId,
          name: fullName.trim(),
          gender,
          blood_group: bloodGroup,
          phone: phoneNumber.trim() || 'N/A',
          emergency_phone: emergencyPhone.trim() || 'N/A',
          height: parseFloat(height) || null,
          weight: parseFloat(weight) || null,
          age: parseInt(age) || null,
          vitals: {},
          notes: '',
          qr_hash: qrHash,
          created_at: now
        };

        await db.patients.add(newPatient);
        await enqueueOfflineAction('patients', 'INSERT', newPatient);
      }

      // 2. Create Queue entry — aligned with Supabase queue table
      const queueId = generateUUID();

      // Triage status: Title Case to match Supabase CHECK constraint ('Red'|'Yellow'|'Green')
      const triageMap = { RED: 'Red', YELLOW: 'Yellow', GREEN: 'Green' };
      const triageStatusMapped = triageMap[triageStatus] || 'Green';

      const vitalsObj = {
        bp: bp || '120/80',
        spo2: spo2 ? `${spo2}%` : '98%',
        heartRate: heartRate ? `${heartRate} bpm` : '75 bpm',
        temp: temp ? `${temp}°F` : '98.6°F'
      };

      const newQueueEntry = {
        id: queueId,
        patient_id: patientId,
        triage_status: triageStatusMapped,
        survival_info: ashaInstructions.trim() || 'Digital Triage Intake by ASHA Worker.',
        status: 'Waiting',
        age: parseInt(age) || null,
        height: parseFloat(height) || null,
        weight: parseFloat(weight) || null,
        vitals: vitalsObj,
        created_at: now,
        updated_at: now
      };

      await db.queue.add(newQueueEntry);
      await enqueueOfflineAction('queue', 'INSERT', newQueueEntry);

      setSuccessMsg(`Patient ${fullName} assigned ${triageStatusMapped} triage & added to Doctor queue!`);

      setTimeout(() => {
        if (onTriageComplete) onTriageComplete();
      }, 1200);

    } catch (err) {
      console.error('Error adding patient triage:', err);
      alert('Failed to save patient triage record. Check browser console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '28px' }}>
        
        {/* Header Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus size={24} color="#06b6d4" />
              <h2 style={{ fontSize: '1.35rem', color: '#f8fafc', fontWeight: 700 }}>Digital Triage & Patient Intake</h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
              Assign emergency status to automatically prioritize patient in Doctor queue.
            </p>
          </div>

          {/* New / Existing Toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => { setMode('new'); setSelectedPatientId(''); setFullName(''); }}
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                background: mode === 'new' ? 'var(--primary)' : 'transparent',
                color: mode === 'new' ? '#fff' : 'var(--text-muted)'
              }}
            >
              New Patient
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('existing')}
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                background: mode === 'existing' ? 'var(--primary)' : 'transparent',
                color: mode === 'existing' ? '#fff' : 'var(--text-muted)'
              }}
            >
              Registered Patient
            </button>
          </div>
        </div>

        {successMsg && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            color: '#6ee7b7',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            <CheckCircle2 size={20} color="#10b981" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* Patient Lookup if Existing */}
          {mode === 'existing' && (
            <div style={{ marginBottom: '20px', background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Select Existing Patient
              </label>
              <select
                className="input-field"
                value={selectedPatientId}
                onChange={(e) => handleSelectExisting(e.target.value)}
                required={mode === 'existing'}
              >
                <option value="">-- Choose Patient from Registry --</option>
                {existingPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.gender}, Blood: {p.blood_group}, Phone: {p.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section 1: Demographic Info */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>1. Basic Patient Information</span>
            </h3>
            
            <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Priya Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={mode === 'existing' && selectedPatientId !== ''}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Gender</label>
                <select
                  className="input-field"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={mode === 'existing' && selectedPatientId !== ''}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Blood Group</label>
                <select
                  className="input-field"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  disabled={mode === 'existing' && selectedPatientId !== ''}
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Phone Number</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={mode === 'existing' && selectedPatientId !== ''}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Emergency Contact Phone</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="+91 98765 00000"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  disabled={mode === 'existing' && selectedPatientId !== ''}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Digital Triage Level (Core Feature) */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} />
              <span>2. Digital Triage Priority Assignment</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              
              {/* RED Triage */}
              <div
                onClick={() => setTriageStatus('RED')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: triageStatus === 'RED' ? '2px solid var(--triage-red-solid)' : '1px solid var(--border-color)',
                  background: triageStatus === 'RED' ? 'var(--triage-red-bg)' : 'rgba(15, 23, 42, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-red">🚨 RED - EMERGENCY</span>
                  <input type="radio" checked={triageStatus === 'RED'} onChange={() => {}} />
                </div>
                <p style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
                  Severe pain, heavy bleeding, chest tightness, stroke, unconsciousness. Immediate consultation required!
                </p>
              </div>

              {/* YELLOW Triage */}
              <div
                onClick={() => setTriageStatus('YELLOW')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: triageStatus === 'YELLOW' ? '2px solid var(--triage-yellow-solid)' : '1px solid var(--border-color)',
                  background: triageStatus === 'YELLOW' ? 'var(--triage-yellow-bg)' : 'rgba(15, 23, 42, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-yellow">⚠️ YELLOW - URGENT</span>
                  <input type="radio" checked={triageStatus === 'YELLOW'} onChange={() => {}} />
                </div>
                <p style={{ fontSize: '0.78rem', color: '#fde047' }}>
                  High fever (&gt;101°F), severe acute pain, persistent vomiting, suspected fractures.
                </p>
              </div>

              {/* GREEN Triage */}
              <div
                onClick={() => setTriageStatus('GREEN')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: triageStatus === 'GREEN' ? '2px solid var(--triage-green-solid)' : '1px solid var(--border-color)',
                  background: triageStatus === 'GREEN' ? 'var(--triage-green-bg)' : 'rgba(15, 23, 42, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-green">🟢 GREEN - STANDARD</span>
                  <input type="radio" checked={triageStatus === 'GREEN'} onChange={() => {}} />
                </div>
                <p style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>
                  Mild cold/cough, skin rash, routine health checkup, prescription renewal, vaccine consultation.
                </p>
              </div>

            </div>
          </div>

          {/* Section 3: Vitals & Observation */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={18} />
              <span>3. Visit Vitals & ASHA Clinical Observations</span>
            </h3>

            <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Age (Yrs)</label>
                <input type="number" className="input-field" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Height (cm)</label>
                <input type="number" className="input-field" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Weight (kg)</label>
                <input type="number" className="input-field" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>BP (sys/dia)</label>
                <input type="text" className="input-field" placeholder="120/80" value={bp} onChange={(e) => setBp(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>SpO2 (%)</label>
                <input type="number" className="input-field" placeholder="98" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Pulse (bpm)</label>
                <input type="number" className="input-field" placeholder="78" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Temp (°F)</label>
                <input type="text" className="input-field" placeholder="98.6" value={temp} onChange={(e) => setTemp(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                ASHA Worker Instructions / Symptoms Notes for Doctor
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="e.g. Patient feels dizzy when standing up. History of high BP. Prefers Hindi translation."
                value={ashaInstructions}
                onChange={(e) => setAshaInstructions(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ padding: '12px 28px', fontSize: '0.95rem' }}
            >
              {isSubmitting ? 'Saving to Queue...' : 'Assign Triage & Add to Doctor Queue'}
              <ArrowRight size={18} />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
