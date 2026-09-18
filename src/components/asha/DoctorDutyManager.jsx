import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
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
    if (!newName.trim()) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const newDoc = {
        id: generateUUID(),
        full_name: newName.trim(),
        specialty: newSpecialty,
        is_on_duty: true,
        phc_id: 'phc-001',
        created_at: now
      };
      await db.doctors.add(newDoc);
      await enqueueOfflineAction('doctors', 'INSERT', newDoc);
      setNewName('');
      setNewSpecialty('General Physician');
      setShowAddForm(false);
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

  const DoctorCard = ({ doctor }) => {
    const onDutyStatus = doctor.is_on_duty;
    return (
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', flexWrap: 'wrap',
          borderLeft: `4px solid ${onDutyStatus ? '#10b981' : '#475569'}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: onDutyStatus ? 'rgba(16,185,129,0.15)' : 'rgba(71,85,105,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Stethoscope size={22} color={onDutyStatus ? '#10b981' : '#64748b'} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem' }}>{doctor.full_name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {doctor.specialty}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
            background: onDutyStatus ? 'rgba(16,185,129,0.15)' : 'rgba(71,85,105,0.2)',
            color: onDutyStatus ? '#6ee7b7' : '#94a3b8',
            border: `1px solid ${onDutyStatus ? 'rgba(16,185,129,0.3)' : 'rgba(71,85,105,0.4)'}`
          }}>
            {onDutyStatus ? '● ON DUTY' : '○ OFF DUTY'}
          </span>

          <button
            onClick={() => handleToggleDuty(doctor)}
            title={onDutyStatus ? 'Mark as Off Duty' : 'Mark as On Duty'}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: '8px', color: onDutyStatus ? '#10b981' : '#64748b',
              display: 'flex', alignItems: 'center'
            }}
          >
            {onDutyStatus ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>

          <button
            onClick={() => handleRemoveDoctor(doctor.id)}
            title="Remove from roster"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: '8px', color: '#64748b',
              display: 'flex', alignItems: 'center'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Stethoscope size={24} color="#06b6d4" />
            <h2 style={{ fontSize: '1.35rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
              Doctor Duty Roster
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
            Manage which doctors are currently on duty. Only on-duty doctors appear in the triage specialist assignment.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
          style={{ padding: '9px 18px', fontSize: '0.85rem' }}
        >
          {showAddForm ? <X size={16} /> : <Plus size={16} />}
          {showAddForm ? 'Cancel' : 'Add Doctor'}
        </button>
      </div>

      {/* Add Doctor Form */}
      {showAddForm && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', border: '1px solid rgba(6,182,212,0.3)' }}>
          <h3 style={{ fontSize: '0.95rem', color: '#06b6d4', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add New Doctor to PHC Roster
          </h3>
          <form onSubmit={handleAddDoctor}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Dr. Full Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Specialty *
                </label>
                <select
                  className="input-field"
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ padding: '8px 20px' }}>
                <Save size={15} />
                {isSaving ? 'Adding…' : 'Add & Set On Duty'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #10b981' }}>
          <UserCheck size={22} color="#10b981" />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6ee7b7' }}>{onDuty.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Doctors On Duty</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #475569' }}>
          <UserX size={22} color="#64748b" />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8' }}>{offDuty.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Doctors Off Duty</div>
          </div>
        </div>
      </div>

      {/* On Duty Section */}
      {onDuty.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            Currently On Duty
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {onDuty.map((d) => <DoctorCard key={d.id} doctor={d} />)}
          </div>
        </div>
      )}

      {/* Off Duty Section */}
      {offDuty.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            Off Duty
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {offDuty.map((d) => <DoctorCard key={d.id} doctor={d} />)}
          </div>
        </div>
      )}

      {doctors.length === 0 && (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Stethoscope size={40} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No doctors registered at this PHC yet.</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '4px' }}>Click "Add Doctor" to register the first doctor.</p>
        </div>
      )}
    </div>
  );
}
