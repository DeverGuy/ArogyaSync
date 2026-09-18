import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import {
  AlertCircle, CheckCircle2, UserPlus, HeartPulse, ShieldAlert,
  ArrowRight, Stethoscope, BookHeart, AlertTriangle
} from 'lucide-react';

/**
 * TriageForm — Full Patient Registration + Digital Triage Intake
 *
 * Handles two modes:
 *   - New Patient: registers the patient AND creates a visit queue entry in one step
 *   - Existing Patient (returning visit): loads profile, creates a new visit entry
 *
 * Captures:
 *   Patient profile: name, gender, blood group, phone, emergency phone, allergies, critical history
 *   Visit data: chief complaint, specialist required (from on-duty doctors), triage (Red/Yellow/Green),
 *               vitals (BP, SpO2, HR, Temp), age, height, weight, ASHA notes for doctor
 */
export function TriageForm({ onTriageComplete, isOnline }) {
  const existingPatients  = useLiveQuery(() => db.patients.toArray(), []) || [];
  // Only on-duty doctors are available for specialist assignment
  const onDutyDoctors     = useLiveQuery(() => db.doctors.toArray().then(ds => ds.filter(d => d.is_on_duty === true)), []) || [];

  const [mode, setMode] = useState('new'); // 'new' | 'existing'
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // ── Patient identity fields ──────────────────────────────────────────────
  const [fullName, setFullName]           = useState('');
  const [gender, setGender]               = useState('Male');
  const [bloodGroup, setBloodGroup]       = useState('O+');
  const [phoneNumber, setPhoneNumber]     = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [allergies, setAllergies]         = useState('');
  const [criticalHistory, setCriticalHistory] = useState('');

  // ── Visit / Triage fields ────────────────────────────────────────────────
  const [chiefComplaint, setChiefComplaint]     = useState('');
  const [specialistRequired, setSpecialistRequired] = useState('');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');
  const [triageStatus, setTriageStatus]         = useState('Green');

  const [age, setAge]           = useState('');
  const [height, setHeight]     = useState('');
  const [weight, setWeight]     = useState('');
  const [bp, setBp]             = useState('');
  const [spo2, setSpo2]         = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temp, setTemp]         = useState('');
  const [ashaInstructions, setAshaInstructions] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg]     = useState('');
  const [errorMsg, setErrorMsg]         = useState('');

  // When a doctor is selected, auto-fill the specialist field with their specialty
  const handleDoctorSelect = (doctorId) => {
    setAssignedDoctorId(doctorId);
    const doc = onDutyDoctors.find((d) => d.id === doctorId);
    if (doc) setSpecialistRequired(doc.specialty);
  };

  const handleSelectExisting = (patientId) => {
    setSelectedPatientId(patientId);
    const p = existingPatients.find((item) => item.id === patientId);
    if (p) {
      setFullName(p.name || '');
      setGender(p.gender || 'Male');
      setBloodGroup(p.blood_group || 'O+');
      setPhoneNumber(p.phone || '');
      setEmergencyPhone(p.emergency_phone || '');
      setAllergies(p.allergies || '');
      setCriticalHistory(p.critical_history || '');
    }
  };

  const resetForm = () => {
    setFullName(''); setGender('Male'); setBloodGroup('O+');
    setPhoneNumber(''); setEmergencyPhone('');
    setAllergies(''); setCriticalHistory('');
    setChiefComplaint(''); setSpecialistRequired(''); setAssignedDoctorId('');
    setTriageStatus('Green');
    setAge(''); setHeight(''); setWeight('');
    setBp(''); setSpo2(''); setHeartRate(''); setTemp('');
    setAshaInstructions('');
    setSelectedPatientId('');
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Patient full name is required.');
      return;
    }
    if (!chiefComplaint.trim()) {
      setErrorMsg('Chief complaint / reason for visit is required.');
      return;
    }
    if (!assignedDoctorId) {
      setErrorMsg('Please assign a doctor from the on-duty roster before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const now = new Date().toISOString();
      let patientId = selectedPatientId;

      // ── 1. Create Patient if new ────────────────────────────────────────
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
          allergies: allergies.trim() || 'None known',
          critical_history: criticalHistory.trim() || 'No significant history.',
          qr_hash: qrHash,
          created_at: now
        };
        await db.patients.add(newPatient);
        await enqueueOfflineAction('patients', 'INSERT', newPatient);
      }

      // ── 2. Create Visit (queue entry) ───────────────────────────────────
      const visitId = generateUUID();
      const vitalsObj = {
        bp:        bp        ? bp               : '—',
        spo2:      spo2      ? `${spo2}%`       : '—',
        heartRate: heartRate ? `${heartRate} bpm` : '—',
        temp:      temp      ? `${temp}°F`      : '—'
      };

      const newVisit = {
        id: visitId,
        patient_id: patientId,
        doctor_id: assignedDoctorId,
        triage_status: triageStatus,
        specialist_required: specialistRequired,
        chief_complaint: chiefComplaint.trim(),
        survival_info: ashaInstructions.trim() || `Digital triage intake — ${chiefComplaint.trim()}`,
        status: 'Waiting',
        age: parseInt(age) || null,
        height: parseFloat(height) || null,
        weight: parseFloat(weight) || null,
        vitals: vitalsObj,
        visit_date: now,
        created_at: now,
        updated_at: now
      };

      await db.visits.add(newVisit);
      await enqueueOfflineAction('visits', 'INSERT', newVisit);

      const assignedDoc = onDutyDoctors.find((d) => d.id === assignedDoctorId);
      setSuccessMsg(
        `✅ ${fullName} registered with ${triageStatus} triage → Assigned to ${assignedDoc?.full_name || 'Doctor'}`
      );

      resetForm();
      setTimeout(() => {
        setSuccessMsg('');
        if (onTriageComplete) onTriageComplete();
      }, 1800);

    } catch (err) {
      console.error('[TriageForm] Submit error:', err);
      setErrorMsg('Failed to save patient record. Please check the browser console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const triageOptions = [
    {
      key: 'Red',
      label: '🚨 RED — EMERGENCY',
      desc: 'Severe chest pain, stroke, unconsciousness, heavy bleeding, respiratory distress. Immediate intervention.',
      bg: 'var(--triage-red-bg)',
      border: 'var(--triage-red-solid)',
      textColor: '#fca5a5'
    },
    {
      key: 'Yellow',
      label: '⚠️ YELLOW — URGENT',
      desc: 'High fever (>101°F), persistent vomiting, severe acute pain, suspected fractures, moderate dehydration.',
      bg: 'var(--triage-yellow-bg)',
      border: 'var(--triage-yellow-solid)',
      textColor: '#fde047'
    },
    {
      key: 'Green',
      label: '🟢 GREEN — STANDARD',
      desc: 'Mild cold/cough, skin rash, routine checkup, prescription renewal, vaccination.',
      bg: 'var(--triage-green-bg)',
      border: 'var(--triage-green-solid)',
      textColor: '#6ee7b7'
    }
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '28px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus size={24} color="#06b6d4" />
              <h2 style={{ fontSize: '1.35rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
                Digital Patient Intake & Triage
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
              Register a new patient or record a returning visit. Assigns them to the smart queue with triage priority.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px' }}>
            {[{ key: 'new', label: 'New Patient' }, { key: 'existing', label: 'Returning Patient' }].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); resetForm(); }}
                style={{
                  padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: mode === key ? 'var(--primary)' : 'transparent',
                  color: mode === key ? '#fff' : 'var(--text-muted)'
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', fontSize: '0.9rem' }}>
            <CheckCircle2 size={20} color="#10b981" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', fontSize: '0.9rem' }}>
            <AlertCircle size={20} color="#ef4444" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── Existing Patient Lookup ──────────────────────────────────── */}
          {mode === 'existing' && (
            <div style={{ marginBottom: '24px', background: 'rgba(15,23,42,0.5)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Select Patient from Registry
              </label>
              <select
                className="input-field"
                value={selectedPatientId}
                onChange={(e) => handleSelectExisting(e.target.value)}
                required={mode === 'existing'}
              >
                <option value="">-- Search patient registry --</option>
                {existingPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.blood_group} · {p.phone}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Section 1: Patient Identity ──────────────────────────────── */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <UserPlus size={16} /> 1. Patient Identity
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Full Name *', value: fullName, setter: setFullName, type: 'text', placeholder: 'e.g. Priya Sharma', disabled: mode === 'existing' && !!selectedPatientId },
                { label: 'Phone Number', value: phoneNumber, setter: setPhoneNumber, type: 'tel', placeholder: '+91 98765 43210', disabled: mode === 'existing' && !!selectedPatientId },
                { label: 'Emergency Contact', value: emergencyPhone, setter: setEmergencyPhone, type: 'tel', placeholder: '+91 98765 00000', disabled: mode === 'existing' && !!selectedPatientId },
              ].map(({ label, value, setter, type, placeholder, disabled }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</label>
                  <input type={type} className="input-field" placeholder={placeholder} value={value}
                    onChange={(e) => setter(e.target.value)} disabled={disabled} required={label.includes('*')} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Gender</label>
                <select className="input-field" value={gender} onChange={(e) => setGender(e.target.value)} disabled={mode === 'existing' && !!selectedPatientId}>
                  {['Male', 'Female', 'Other'].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Blood Group</label>
                <select className="input-field" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} disabled={mode === 'existing' && !!selectedPatientId}>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Medical Background (QR-encoded) ───────────────── */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#06b6d4', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <BookHeart size={16} /> 2. Medical Background
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (Encoded in patient QR code — offline accessible)
              </span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Known Allergies
                </label>
                <textarea className="input-field" rows={2} placeholder="e.g. Penicillin, Aspirin — or 'None known'"
                  value={allergies} onChange={(e) => setAllergies(e.target.value)}
                  disabled={mode === 'existing' && !!selectedPatientId}
                  style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Critical Medical History
                </label>
                <textarea className="input-field" rows={2} placeholder="e.g. History of MI (2023), Hypertension, Diabetes"
                  value={criticalHistory} onChange={(e) => setCriticalHistory(e.target.value)}
                  disabled={mode === 'existing' && !!selectedPatientId}
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* ── Section 3: Visit Details & Specialist Assignment ─────────── */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Stethoscope size={16} /> 3. Visit Details & Doctor Assignment
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Chief Complaint / Reason for Visit *
                </label>
                <input type="text" className="input-field" placeholder="e.g. Severe chest pain, high fever"
                  value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Assign to Doctor (On Duty) *
                </label>
                {onDutyDoctors.length === 0 ? (
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', fontSize: '0.8rem', color: '#fde047', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} />
                    No doctors currently on duty. Go to the Duty Roster tab to set availability.
                  </div>
                ) : (
                  <select className="input-field" value={assignedDoctorId} onChange={(e) => handleDoctorSelect(e.target.value)} required>
                    <option value="">-- Select an on-duty doctor --</option>
                    {onDutyDoctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} · {d.specialty}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 4: Triage Priority ───────────────────────────────── */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <ShieldAlert size={16} /> 4. Triage Priority
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {triageOptions.map(({ key, label, desc, bg, border, textColor }) => (
                <div
                  key={key}
                  onClick={() => setTriageStatus(key)}
                  style={{
                    padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease',
                    border: triageStatus === key ? `2px solid ${border}` : '1px solid var(--border-color)',
                    background: triageStatus === key ? bg : 'rgba(15,23,42,0.4)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: triageStatus === key ? textColor : 'var(--text-muted)' }}>
                      {label}
                    </span>
                    <input type="radio" readOnly checked={triageStatus === key} style={{ accentColor: border }} />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: triageStatus === key ? textColor : '#64748b', margin: 0, lineHeight: 1.5 }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 5: Vitals ───────────────────────────────────────── */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#06b6d4', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <HeartPulse size={16} /> 5. Vitals & Biometrics
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              {[
                { label: 'Age (Yrs)', value: age, setter: setAge, type: 'number', placeholder: '45' },
                { label: 'Height (cm)', value: height, setter: setHeight, type: 'number', placeholder: '168' },
                { label: 'Weight (kg)', value: weight, setter: setWeight, type: 'number', placeholder: '65' },
                { label: 'BP (sys/dia)', value: bp, setter: setBp, type: 'text', placeholder: '120/80' },
                { label: 'SpO2 (%)', value: spo2, setter: setSpo2, type: 'number', placeholder: '98' },
                { label: 'Pulse (bpm)', value: heartRate, setter: setHeartRate, type: 'number', placeholder: '78' },
                { label: 'Temp (°F)', value: temp, setter: setTemp, type: 'text', placeholder: '98.6' }
              ].map(({ label, value, setter, type, placeholder }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{label}</label>
                  <input type={type} className="input-field" placeholder={placeholder} value={value} onChange={(e) => setter(e.target.value)} />
                </div>
              ))}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                ASHA Notes / Critical Observations for Doctor
              </label>
              <textarea className="input-field" rows={3} style={{ resize: 'vertical' }}
                placeholder="e.g. Patient is visibly distressed. Possible MI history — attach previous ECG. Prefers Hindi communication."
                value={ashaInstructions} onChange={(e) => setAshaInstructions(e.target.value)} />
            </div>
          </div>

          {/* ── Submit ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || onDutyDoctors.length === 0}
              style={{ padding: '12px 32px', fontSize: '0.95rem' }}
            >
              {isSubmitting ? 'Registering Patient…' : 'Register & Add to Smart Queue'}
              <ArrowRight size={18} />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
