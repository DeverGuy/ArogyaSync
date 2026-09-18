import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import { motion, AnimatePresence } from 'motion/react';
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
      label: 'Red — Emergency',
      desc: 'Severe chest pain, stroke, unconsciousness, heavy bleeding, respiratory distress. Immediate intervention.',
      badgeClasses: 'bg-[#FDEBEC] text-[#9F2F2D]'
    },
    {
      key: 'Yellow',
      label: 'Yellow — Urgent',
      desc: 'High fever (>101°F), persistent vomiting, severe acute pain, suspected fractures, moderate dehydration.',
      badgeClasses: 'bg-[#FBF3DB] text-[#956400]'
    },
    {
      key: 'Green',
      label: 'Green — Standard',
      desc: 'Mild cold/cough, skin rash, routine checkup, prescription renewal, vaccination.',
      badgeClasses: 'bg-[#EDF3EC] text-[#346538]'
    }
  ];

  const inputClasses = "w-full bg-[#FBFBFA] border border-[#EAEAEA] rounded-md px-3 py-2 text-sm text-[#111111] placeholder:text-[#787774] focus:outline-none focus:border-[#111111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
  const labelClasses = "block text-xs font-medium text-[#787774] mb-1.5";
  const sectionTitleClasses = "text-sm font-semibold text-[#111111] mb-4 flex items-center gap-2 uppercase tracking-wide";

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#EAEAEA] rounded-xl p-6 md:p-8"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start md:items-center justify-between mb-8 flex-col md:flex-row gap-4">
          <div>
            <div className="flex items-center gap-3">
              <UserPlus className="w-6 h-6 text-[#111111]" />
              <h2 className="text-xl font-bold text-[#111111] m-0">
                Digital Patient Intake & Triage
              </h2>
            </div>
            <p className="text-sm text-[#787774] mt-1.5 m-0">
              Register a new patient or record a returning visit. Assigns them to the smart queue with triage priority.
            </p>
          </div>
          <div className="flex gap-1 bg-[#F9F9F8] p-1 rounded-md border border-[#EAEAEA] shrink-0">
            {[{ key: 'new', label: 'New Patient' }, { key: 'existing', label: 'Returning Patient' }].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); resetForm(); }}
                className={`px-4 py-2 text-xs font-medium rounded-md border-none cursor-pointer transition-colors ${
                  mode === key 
                    ? 'bg-white text-[#111111] shadow-sm border border-[#EAEAEA]' 
                    : 'bg-transparent text-[#787774] hover:text-[#111111]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence mode="popLayout">
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="px-4 py-3 mb-6 bg-[#EDF3EC] border border-[#EAEAEA] rounded-md text-[#346538] flex items-center gap-3 text-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-[#346538]" />
              <span>{successMsg}</span>
            </motion.div>
          )}
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="px-4 py-3 mb-6 bg-[#FDEBEC] border border-[#EAEAEA] rounded-md text-[#9F2F2D] flex items-center gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 text-[#9F2F2D]" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Existing Patient Lookup ──────────────────────────────────── */}
          {mode === 'existing' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-[#F9F9F8] rounded-xl border border-[#EAEAEA]"
            >
              <label className={labelClasses}>Select Patient from Registry</label>
              <select
                className={inputClasses}
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
            </motion.div>
          )}

          {/* ── Section 1: Patient Identity ──────────────────────────────── */}
          <div>
            <h3 className={sectionTitleClasses}>
              <UserPlus className="w-4 h-4" /> 1. Patient Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Full Name *', value: fullName, setter: setFullName, type: 'text', placeholder: 'e.g. Priya Sharma', disabled: mode === 'existing' && !!selectedPatientId },
                { label: 'Phone Number', value: phoneNumber, setter: setPhoneNumber, type: 'tel', placeholder: '+91 98765 43210', disabled: mode === 'existing' && !!selectedPatientId },
                { label: 'Emergency Contact', value: emergencyPhone, setter: setEmergencyPhone, type: 'tel', placeholder: '+91 98765 00000', disabled: mode === 'existing' && !!selectedPatientId },
              ].map(({ label, value, setter, type, placeholder, disabled }) => (
                <div key={label}>
                  <label className={labelClasses}>{label}</label>
                  <input type={type} className={inputClasses} placeholder={placeholder} value={value}
                    onChange={(e) => setter(e.target.value)} disabled={disabled} required={label.includes('*')} />
                </div>
              ))}
              <div>
                <label className={labelClasses}>Gender</label>
                <select className={inputClasses} value={gender} onChange={(e) => setGender(e.target.value)} disabled={mode === 'existing' && !!selectedPatientId}>
                  {['Male', 'Female', 'Other'].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Blood Group</label>
                <select className={inputClasses} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} disabled={mode === 'existing' && !!selectedPatientId}>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Medical Background (QR-encoded) ───────────────── */}
          <div>
            <h3 className={sectionTitleClasses}>
              <BookHeart className="w-4 h-4" /> 2. Medical Background
              <span className="text-xs text-[#787774] font-normal normal-case tracking-normal ml-2 hidden sm:inline">
                (Encoded in patient QR code)
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Known Allergies</label>
                <textarea className={`${inputClasses} resize-y`} rows={2} placeholder="e.g. Penicillin, Aspirin — or 'None known'"
                  value={allergies} onChange={(e) => setAllergies(e.target.value)}
                  disabled={mode === 'existing' && !!selectedPatientId} />
              </div>
              <div>
                <label className={labelClasses}>Critical Medical History</label>
                <textarea className={`${inputClasses} resize-y`} rows={2} placeholder="e.g. History of MI (2023), Hypertension, Diabetes"
                  value={criticalHistory} onChange={(e) => setCriticalHistory(e.target.value)}
                  disabled={mode === 'existing' && !!selectedPatientId} />
              </div>
            </div>
          </div>

          {/* ── Section 3: Visit Details & Specialist Assignment ─────────── */}
          <div>
            <h3 className={sectionTitleClasses}>
              <Stethoscope className="w-4 h-4" /> 3. Visit Details & Doctor Assignment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Chief Complaint / Reason for Visit *</label>
                <input type="text" className={inputClasses} placeholder="e.g. Severe chest pain, high fever"
                  value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} required />
              </div>
              <div>
                <label className={labelClasses}>Assign to Doctor (On Duty) *</label>
                {onDutyDoctors.length === 0 ? (
                  <div className="px-4 py-2.5 bg-[#FBF3DB] border border-[#EAEAEA] rounded-md text-sm text-[#956400] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    No doctors currently on duty. Set availability in Duty Roster.
                  </div>
                ) : (
                  <select className={inputClasses} value={assignedDoctorId} onChange={(e) => handleDoctorSelect(e.target.value)} required>
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
          <div>
            <h3 className={sectionTitleClasses}>
              <ShieldAlert className="w-4 h-4" /> 4. Triage Priority
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {triageOptions.map(({ key, label, desc, badgeClasses }) => (
                <div
                  key={key}
                  onClick={() => setTriageStatus(key)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                    triageStatus === key 
                      ? 'border-[#111111] bg-white shadow-sm' 
                      : 'border-[#EAEAEA] bg-[#F9F9F8] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider font-semibold ${badgeClasses}`}>
                      {label}
                    </span>
                    <input 
                      type="radio" 
                      readOnly 
                      checked={triageStatus === key} 
                      className="accent-[#111111] w-4 h-4"
                    />
                  </div>
                  <p className="text-xs m-0 leading-relaxed text-[#787774]">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 5: Vitals ───────────────────────────────────────── */}
          <div>
            <h3 className={sectionTitleClasses}>
              <HeartPulse className="w-4 h-4" /> 5. Vitals & Biometrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
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
                  <label className={labelClasses}>{label}</label>
                  <input type={type} className={inputClasses} placeholder={placeholder} value={value} onChange={(e) => setter(e.target.value)} />
                </div>
              ))}
            </div>
            <div>
              <label className={labelClasses}>
                ASHA Notes / Critical Observations for Doctor
              </label>
              <textarea className={`${inputClasses} resize-y`} rows={3}
                placeholder="e.g. Patient is visibly distressed. Possible MI history — attach previous ECG. Prefers Hindi communication."
                value={ashaInstructions} onChange={(e) => setAshaInstructions(e.target.value)} />
            </div>
          </div>

          {/* ── Submit ──────────────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || onDutyDoctors.length === 0}
              className="bg-[#111111] text-white hover:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed px-6 py-2.5 text-sm font-semibold rounded-md transition-transform duration-200 flex items-center gap-2"
            >
              {isSubmitting ? 'Registering Patient…' : 'Register & Add to Smart Queue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
}
