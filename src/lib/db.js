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

export const seedInitialData = async () => {
  console.log('[ArogyaSync] Force-clearing old data and seeding realistic data into IndexedDB...');

  await db.patients.clear();
  await db.doctors.clear();
  await db.visits.clear();
  await db.inventory.clear();
  await db.documents.clear();

  const now = new Date().toISOString();

  // ── Doctors ──────────────────────────────────────────────────────────────
  const doc1Id = generateUUID();
  const doc2Id = generateUUID();
  const doc3Id = generateUUID();
  const doc4Id = generateUUID();

  await db.doctors.bulkAdd([
    { id: doc1Id, full_name: 'Dr. Anjali Desai', specialty: 'General Physician', is_on_duty: true, phc_id: 'phc-alpha', created_at: now },
    { id: doc2Id, full_name: 'Dr. Vikram Singh', specialty: 'Cardiologist', is_on_duty: true, phc_id: 'phc-alpha', created_at: now },
    { id: doc3Id, full_name: 'Dr. Meera Swaminathan', specialty: 'Pediatrician', is_on_duty: false, phc_id: 'phc-alpha', created_at: now },
    { id: doc4Id, full_name: 'Dr. Rohan Kapoor', specialty: 'Orthopedist', is_on_duty: true, phc_id: 'phc-alpha', created_at: now }
  ]);

  // ── Patients ──────────────────────────────────────────────────────────────
  const patient1Id = generateUUID();
  const patient2Id = generateUUID();
  const patient3Id = generateUUID();
  const patient4Id = generateUUID();
  const patient5Id = generateUUID();

  await db.patients.bulkAdd([
    {
      id: patient1Id,
      name: 'Prakash Verma',
      gender: 'Male',
      blood_group: 'O+',
      phone: '+91 98765 12345',
      emergency_phone: '+91 98765 12346',
      allergies: 'None',
      critical_history: 'Hypertension (since 2018), Type 2 Diabetes',
      qr_hash: `AROGYA-${patient1Id.slice(0, 8)}-O+`,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString()
    },
    {
      id: patient2Id,
      name: 'Lakshmi Narayan',
      gender: 'Female',
      blood_group: 'B+',
      phone: '+91 91234 56789',
      emergency_phone: '+91 91234 56790',
      allergies: 'Sulfa antibiotics',
      critical_history: 'Asthma (diagnosed childhood), prior c-section (2020)',
      qr_hash: `AROGYA-${patient2Id.slice(0, 8)}-B+`,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: patient3Id,
      name: 'Ravi Kumar (Child)',
      gender: 'Male',
      blood_group: 'A+',
      phone: '+91 99887 76655',
      emergency_phone: '+91 99887 76655',
      allergies: 'Peanuts',
      critical_history: 'Premature birth (32 weeks)',
      qr_hash: `AROGYA-${patient3Id.slice(0, 8)}-A+`,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: patient4Id,
      name: 'Smita Patil',
      gender: 'Female',
      blood_group: 'AB-',
      phone: '+91 99001 12233',
      emergency_phone: '+91 99001 12234',
      allergies: 'Latex',
      critical_history: 'No major medical history',
      qr_hash: `AROGYA-${patient4Id.slice(0, 8)}-AB-`,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: patient5Id,
      name: 'Devendra Joshi',
      gender: 'Male',
      blood_group: 'O-',
      phone: '+91 98111 22233',
      emergency_phone: '+91 98111 22244',
      allergies: 'Ibuprofen',
      critical_history: 'Coronary artery bypass graft (CABG) in 2021',
      qr_hash: `AROGYA-${patient5Id.slice(0, 8)}-O-`,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString()
    }
  ]);

  // ── Visits (active queue) ────────────────────────────────────────────────
  const visit1Id = generateUUID();
  const visit2Id = generateUUID();
  const visit3Id = generateUUID();
  const visit4Id = generateUUID();

  await db.visits.bulkAdd([
    {
      id: visit1Id,
      patient_id: patient5Id, // Devendra (CABG history)
      doctor_id: doc2Id,      // Cardiologist
      triage_status: 'Red',
      specialist_required: 'Cardiologist',
      chief_complaint: 'Crushing chest pain radiating to left arm, heavy sweating',
      survival_info: 'CRITICAL: Patient has history of CABG. Complaining of severe chest pain. Immediate ECG required.',
      status: 'Waiting',
      age: 62,
      height: 168,
      weight: 78,
      vitals: { bp: '165/100', spo2: '92%', heartRate: '115 bpm', temp: '98.8°F' },
      visit_date: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
      created_at: new Date(Date.now() - 600000).toISOString(),
      updated_at: now
    },
    {
      id: visit2Id,
      patient_id: patient2Id, // Lakshmi (Asthma)
      doctor_id: doc1Id,      // General
      triage_status: 'Yellow',
      specialist_required: 'General Physician',
      chief_complaint: 'Wheezing and shortness of breath since morning',
      survival_info: 'Known asthmatic. Current exacerbation. Given nebulizer at ASHA center.',
      status: 'In Consultation',
      age: 31,
      height: 160,
      weight: 58,
      vitals: { bp: '130/85', spo2: '94%', heartRate: '92 bpm', temp: '99.0°F' },
      visit_date: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: now
    },
    {
      id: visit3Id,
      patient_id: patient3Id, // Ravi (Child)
      doctor_id: doc3Id,      // Pediatrician
      triage_status: 'Yellow',
      specialist_required: 'Pediatrician',
      chief_complaint: 'High grade fever (103F) for 2 days, lethargy',
      survival_info: 'Child is very lethargic. Acetaminophen given 4 hours ago, fever persists.',
      status: 'Waiting',
      age: 4,
      height: 105,
      weight: 16,
      vitals: { bp: '90/60', spo2: '98%', heartRate: '120 bpm', temp: '103.2°F' },
      visit_date: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: now
    },
    {
      id: visit4Id,
      patient_id: patient4Id, // Smita
      doctor_id: doc1Id,      // General
      triage_status: 'Green',
      specialist_required: 'General Physician',
      chief_complaint: 'Routine antenatal checkup (2nd trimester)',
      survival_info: 'Routine checkup. Mother feels active fetal movements. No bleeding.',
      status: 'Waiting',
      age: 26,
      height: 165,
      weight: 65,
      vitals: { bp: '110/70', spo2: '99%', heartRate: '78 bpm', temp: '98.4°F' },
      visit_date: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: now
    }
  ]);

  // ── Inventory ─────────────────────────────────────────────────────────────
  await db.inventory.bulkAdd([
    { id: generateUUID(), item_name: 'Paracetamol 500mg Tablets', quantity: 850, unit: 'tablets', min_threshold: 200, last_updated: now },
    { id: generateUUID(), item_name: 'Amoxicillin 500mg Capsules', quantity: 120,  unit: 'capsules', min_threshold: 100, last_updated: now },
    { id: generateUUID(), item_name: 'Salbutamol Nebulizer Solution', quantity: 12, unit: 'vials', min_threshold: 20, last_updated: now },
    { id: generateUUID(), item_name: 'Rapid Antigen Test (COVID-19)', quantity: 45, unit: 'kits', min_threshold: 50, last_updated: now },
    { id: generateUUID(), item_name: 'Oral Rehydration Salts (ORS)', quantity: 300, unit: 'sachets', min_threshold: 100, last_updated: now },
    { id: generateUUID(), item_name: 'IV Fluids (Normal Saline 500ml)', quantity: 24, unit: 'bottles', min_threshold: 30, last_updated: now },
    { id: generateUUID(), item_name: 'Sterile Gauze Pads (4x4)', quantity: 150, unit: 'pads', min_threshold: 50, last_updated: now }
  ]);

  console.log('[ArogyaSync] Proper realistic data seeding complete.');
};

seedInitialData();
