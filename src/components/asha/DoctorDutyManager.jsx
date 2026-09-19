import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import { motion, AnimatePresence } from 'motion/react';
import {
  Stethoscope, UserCheck, UserX, Plus, Save, Trash2, X, ToggleLeft, ToggleRight
} from 'lucide-react';

const SPECIALTIES = [
  'General Physician',
  'Cardiologist',
  'Pediatrician',
  'Gynecologist',
  'Orthopedic Surgeon',
  'Dermatologist',
  'ENT Specialist',
  'Ophthalmologist',
  'Neurologist',
  'Psychiatrist',
  'Dentist',
  'Other'
];

const DoctorCard = ({ doctor, onToggleDuty, onRemoveDoctor }) => {
  const onDutyStatus = doctor.is_on_duty;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#EAEAEA] bg-white p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-3.5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          onDutyStatus ? 'bg-[#EDF3EC]' : 'bg-[#F9F9F8]'
        }`}>
          <Stethoscope className={`h-5 w-5 ${onDutyStatus ? 'text-[#346538]' : 'text-[#787774]'}`} />
        </div>
        <div>
          <div className="font-medium text-[#111111]">{doctor.full_name}</div>
          <div className="mt-0.5 text-sm text-[#787774]">
            {doctor.specialty}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.05em] ${
          onDutyStatus 
            ? 'bg-[#EDF3EC] text-[#346538]' 
            : 'bg-[#F9F9F8] text-[#787774]'
        }`}>
          {onDutyStatus ? 'On Duty' : 'Off Duty'}
        </span>

        <button
          onClick={() => onToggleDuty(doctor)}
          title={onDutyStatus ? 'Mark as Off Duty' : 'Mark as On Duty'}
          className={`flex items-center justify-center rounded-md p-1.5 transition-transform hover:scale-95 ${
            onDutyStatus 
              ? 'text-[#346538]' 
              : 'text-[#787774]'
          }`}
        >
          {onDutyStatus ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
        </button>

        <button
          onClick={() => onRemoveDoctor(doctor.id)}
          title="Remove from roster"
          className="flex items-center justify-center rounded-md p-1.5 text-[#787774] transition-transform hover:scale-95 hover:text-[#9F2F2D]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
};

/**
 * DoctorDutyManager (ASHA Dashboard — Duty Roster Tab)
 *
 * Allows ASHA workers to:
 *   - View all doctors registered at this PHC
 *   - Toggle doctors on-duty / off-duty
 *   - Add new doctors to the PHC roster
 *   - Remove doctors from the roster
 *
 * This roster is the source of truth for the specialist dropdown in TriageForm.
 * Only ON-DUTY doctors appear in the triage specialist selection.
 */
export function DoctorDutyManager() {
  const doctors = useLiveQuery(() => db.doctors.toArray(), []) || [];
  const onDuty  = doctors.filter((d) => d.is_on_duty);
  const offDuty = doctors.filter((d) => !d.is_on_duty);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('General Physician');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleDuty = async (doctor) => {
    try {
      const payload = { id: doctor.id, is_on_duty: !doctor.is_on_duty };
      await db.doctors.update(doctor.id, payload);
      await enqueueOfflineAction('doctors', 'UPDATE', payload);
    } catch (err) {
      console.error('[DoctorDutyManager] Toggle duty failed:', err);
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !password.trim()) return;
    setIsSaving(true);

    try {
      // Generate sequential doctor number
      const currentPhc = localStorage.getItem('current_phc') || 'PHC-UNK-01';
      const parts = currentPhc.split('-');
      const cityCode = parts.length > 1 ? parts[1] : 'UNK';
      
      const count = await db.doctors.count();
      // start at 101, so + 101
      const seqNo = count + 101; 
      const doctorNo = `DOC-${cityCode}-${seqNo}`;
      const phcId = currentPhc; 

      const now = new Date().toISOString();
      const newDoc = {
        id: generateUUID(),
        full_name: newName.trim(),
        specialty: newSpecialty,
        is_on_duty: true,
        phc_id: phcId,
        created_at: now
      };
      await db.doctors.add(newDoc);
      await enqueueOfflineAction('doctors', 'INSERT', newDoc);
      
      // Queue Supabase Auth User Creation
      const email = `doc-${phcId.toLowerCase()}-${doctorNo.toLowerCase()}@arogyasync.com`;
      await enqueueOfflineAction('auth.users', 'CREATE_AUTH_USER', {
        email,
        password: password.trim(),
        full_name: newDoc.full_name,
        role: 'doctor'
      });

      setNewName('');
      setNewSpecialty('General Physician');
      setPassword('');
      setShowAddForm(false);
      alert(`Doctor added successfully!\n\nDoctor Number: ${doctorNo}\nPassword: ${password}\n\nPlease share this with the doctor to login.`);
    } catch (err) {
      console.error('[DoctorDutyManager] Add doctor failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDoctor = async (doctorId) => {
    if (!window.confirm('Remove this doctor from the PHC roster?')) return;
    try {
      await db.doctors.delete(doctorId);
      await enqueueOfflineAction('doctors', 'DELETE', { id: doctorId });
    } catch (err) {
      console.error('[DoctorDutyManager] Remove doctor failed:', err);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EAEAEA] pb-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Stethoscope className="h-6 w-6 text-[#111111]" />
            <h2 className="m-0 text-2xl font-medium tracking-tight text-[#111111]">
              Doctor Duty Roster
            </h2>
          </div>
          <p className="m-0 text-base text-[#787774]">
            Manage which doctors are currently on duty. Only on-duty doctors appear in the triage specialist assignment.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-95 active:scale-95"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddForm ? 'Cancel' : 'Add Doctor'}
        </button>
      </div>

      {/* Add Doctor Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mb-2 rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-6">
              <h3 className="mb-6 flex items-center gap-2 text-sm font-medium text-[#111111]">
                <Plus className="h-4 w-4" /> Add New Doctor to PHC Roster
              </h3>
              <form onSubmit={handleAddDoctor}>
                <div className="mb-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111111]">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#111111] placeholder-[#787774] focus:border-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                      placeholder="Dr. Full Name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111111]">
                      Specialty *
                    </label>
                    <select
                      className="w-full rounded-md border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#111111] focus:border-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                      value={newSpecialty}
                      onChange={(e) => setNewSpecialty(e.target.value)}
                    >
                      {SPECIALTIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#111111]">
                      Password for Doctor *
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-md border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#111111] placeholder-[#787774] focus:border-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                      placeholder="e.g. securepassword123"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-xs text-[#787774]">Doctor Number will be auto-generated upon saving.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#111111] transition-transform hover:scale-95"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-95 disabled:opacity-50"
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Adding…' : 'Add & Set On Duty'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Row */}
      <div className="grid gap-6 sm:grid-cols-2">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="flex items-center gap-4 rounded-xl border border-[#EAEAEA] bg-white p-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EDF3EC]">
            <UserCheck className="h-6 w-6 text-[#346538]" />
          </div>
          <div>
            <div className="text-2xl font-medium text-[#111111]">{onDuty.length}</div>
            <div className="text-sm text-[#787774]">Doctors On Duty</div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="flex items-center gap-4 rounded-xl border border-[#EAEAEA] bg-white p-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F9F9F8]">
            <UserX className="h-6 w-6 text-[#787774]" />
          </div>
          <div>
            <div className="text-2xl font-medium text-[#111111]">{offDuty.length}</div>
            <div className="text-sm text-[#787774]">Doctors Off Duty</div>
          </div>
        </motion.div>
      </div>

      {/* On Duty Section */}
      {onDuty.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        >
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.05em] text-[#787774]">
            Currently On Duty
          </h3>
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {onDuty.map((d) => (
                <DoctorCard 
                  key={d.id} 
                  doctor={d} 
                  onToggleDuty={handleToggleDuty} 
                  onRemoveDoctor={handleRemoveDoctor} 
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Off Duty Section */}
      {offDuty.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        >
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.05em] text-[#787774]">
            Off Duty
          </h3>
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {offDuty.map((d) => (
                <DoctorCard 
                  key={d.id} 
                  doctor={d} 
                  onToggleDuty={handleToggleDuty} 
                  onRemoveDoctor={handleRemoveDoctor} 
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {doctors.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl border border-[#EAEAEA] bg-white p-16 text-center"
        >
          <Stethoscope className="mx-auto mb-4 h-12 w-12 text-[#787774]" />
          <p className="text-base font-medium text-[#111111]">No doctors registered at this PHC yet.</p>
          <p className="mt-2 text-sm text-[#787774]">Click "Add Doctor" to register the first doctor.</p>
        </motion.div>
      )}
    </div>
  );
}
