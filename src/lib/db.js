import Dexie from 'dexie';

export const db = new Dexie('ArogyaSyncLocalDB');

/**
 * ArogyaSync Local Database (IndexedDB via Dexie)
 *
 * Schema:
 *   patients    — permanent patient identity (name, blood group, allergies, critical history, QR hash)
 *   visits      — per-visit records: triage, vitals, status, assigned doctor, specialist type
 *   documents   — references to lab records / X-rays stored in Supabase Storage
 *   doctors     — PHC doctor roster with specialty and duty status (managed by ASHA)
 *   inventory   — PHC medical stock
 *   sync_queue  — offline action log for Supabase replay
 */
db.version(3).stores({
  patients:   'id, name, phone, blood_group, qr_hash, created_at',
  visits:     'id, patient_id, doctor_id, triage_status, status, specialist_required, created_at',
  documents:  'id, patient_id, visit_id, document_type, uploaded_at',
  doctors:    'id, full_name, specialty, is_on_duty, phc_id',
  inventory:  'id, item_name, quantity, min_threshold, last_updated',
  sync_queue: '++id, table_name, action, timestamp, status'
});

// Helper: UUID generator (works offline)
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Seed synthetic data — only runs on first install OR after a schema upgrade
// that wiped the doctors/visits tables (v1 → v2 migration).
export const seedInitialData = async () => {
  const patientCount = await db.patients.count();
  const doctorCount  = await db.doctors.count();
  // Run seed if either patients or doctors are missing (handles fresh install + upgrades)
  if (patientCount > 0 && doctorCount > 0) return;

  console.log('[ArogyaSync] Seeding synthetic data into IndexedDB...');

  const now = new Date().toISOString();

  // ── Doctors ──────────────────────────────────────────────────────────────
  const doc1Id = generateUUID();
  const doc2Id = generateUUID();
  const doc3Id = generateUUID();

  await db.doctors.bulkAdd([
    {
      id: doc1Id,
      full_name: 'Dr. Arjun Mehta',
      specialty: 'General Physician',
      is_on_duty: true,
      phc_id: 'phc-001',
      created_at: now
    },
    {
      id: doc2Id,
      full_name: 'Dr. Priya Nair',
      specialty: 'Cardiologist',
      is_on_duty: true,
      phc_id: 'phc-001',
      created_at: now
    },
    {
      id: doc3Id,
      full_name: 'Dr. Sanjay Rao',
      specialty: 'Pediatrician',
      is_on_duty: false,
      phc_id: 'phc-001',
      created_at: now
    }
  ]);

  // ── Patients ──────────────────────────────────────────────────────────────
  const patient1Id = generateUUID();
  const patient2Id = generateUUID();
  const patient3Id = generateUUID();

  await db.patients.bulkAdd([
    {
      id: patient1Id,
      name: 'Ramesh Kumar',
      gender: 'Male',
      blood_group: 'O+',
      phone: '+91 9876543210',
      emergency_phone: '+91 9876543211',
      allergies: 'Penicillin, Aspirin',
      critical_history: 'History of myocardial infarction (2023). Hypertension diagnosed 2019.',
      qr_hash: `AROGYA-${patient1Id.slice(0, 8)}-O+`,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: patient2Id,
      name: 'Sunita Devi',
      gender: 'Female',
      blood_group: 'B+',
      phone: '+91 9123456789',
      emergency_phone: '+91 9123456780',
      allergies: 'Sulfa drugs',
      critical_history: 'Gestational diabetes (2021). No known cardiac history.',
      qr_hash: `AROGYA-${patient2Id.slice(0, 8)}-B+`,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: patient3Id,
      name: 'Aarav Sharma',
      gender: 'Male',
      blood_group: 'A+',
      phone: '+91 9988776655',
      emergency_phone: '+91 9988776654',
      allergies: 'None known',
      critical_history: 'No significant medical history.',
      qr_hash: `AROGYA-${patient3Id.slice(0, 8)}-A+`,
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ]);

  // ── Visits (active queue) ────────────────────────────────────────────────
  const visit1Id = generateUUID();
  const visit2Id = generateUUID();
  const visit3Id = generateUUID();

  await db.visits.bulkAdd([
    {
      id: visit1Id,
      patient_id: patient1Id,
      doctor_id: doc2Id,   // Assigned to Cardiologist
      triage_status: 'Red',
      specialist_required: 'Cardiologist',
      chief_complaint: 'Severe chest tightness and shortness of breath',
      survival_info: 'Patient complaining of severe chest tightness and shortness of breath. History of heart attack. IMMEDIATE review needed.',
      status: 'Waiting',
      age: 48,
      height: 172,
      weight: 68,
      vitals: { bp: '150/95', spo2: '89%', heartRate: '110 bpm', temp: '99.1°F' },
      visit_date: new Date(Date.now() - 3600000 * 2).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: now
    },
    {
      id: visit2Id,
      patient_id: patient2Id,
      doctor_id: doc1Id,   // Assigned to General Physician
      triage_status: 'Yellow',
      specialist_required: 'General Physician',
      chief_complaint: 'High fever for 3 days, acute fatigue',
      survival_info: 'High fever for 3 days, acute fatigue and body pain. Possible viral infection.',
      status: 'Waiting',
      age: 34,
      height: 158,
      weight: 55,
      vitals: { bp: '128/82', spo2: '96%', heartRate: '88 bpm', temp: '101.4°F' },
      visit_date: new Date(Date.now() - 3600000 * 3).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: now
    },
    {
      id: visit3Id,
      patient_id: patient3Id,
      doctor_id: doc1Id,   // Assigned to General Physician
      triage_status: 'Green',
      specialist_required: 'General Physician',
      chief_complaint: 'Routine health checkup and vaccine consultation',
      survival_info: 'Routine health checkup and vaccine consultation.',
      status: 'Waiting',
      age: 22,
      height: 175,
      weight: 70,
      vitals: { bp: '120/80', spo2: '99%', heartRate: '72 bpm', temp: '98.6°F' },
      visit_date: new Date(Date.now() - 3600000 * 4).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: now
    }
  ]);

  // ── Inventory ─────────────────────────────────────────────────────────────
  await db.inventory.bulkAdd([
    { id: generateUUID(), item_name: 'Paracetamol 500mg Tablets', quantity: 450, unit: 'tablets', min_threshold: 100, last_updated: now },
    { id: generateUUID(), item_name: 'Amoxicillin 250mg Capsules', quantity: 25,  unit: 'capsules', min_threshold: 50, last_updated: now },
    { id: generateUUID(), item_name: 'ORS Packets', quantity: 120, unit: 'sachets', min_threshold: 40, last_updated: now },
    { id: generateUUID(), item_name: 'Rapid Malaria Test Kits', quantity: 15, unit: 'kits', min_threshold: 30, last_updated: now },
    { id: generateUUID(), item_name: 'Disposable Syringes (5ml)', quantity: 200, unit: 'pieces', min_threshold: 50, last_updated: now },
    { id: generateUUID(), item_name: 'Bandages (Crepe 10cm)', quantity: 80, unit: 'rolls', min_threshold: 20, last_updated: now }
  ]);

  console.log('[ArogyaSync] Synthetic data seeding complete.');
};
