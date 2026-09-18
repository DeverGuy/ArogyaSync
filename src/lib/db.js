import Dexie from 'dexie';

export const db = new Dexie('ArogyaSyncLocalDB');

/**
 * Database schema — aligned with Supabase (Moksh's migration):
 *   patients: name, phone, emergency_phone, blood_group, gender, height, weight, age, vitals (object), notes, qr_hash
 *   queue:    patient_id, triage_status ('Red'|'Yellow'|'Green'), survival_info,
 *             status ('Waiting'|'In Progress'|'Completed'), age, height, weight, vitals (object)
 *   inventory: item_name, quantity, unit, min_threshold, last_updated
 *   sync_queue: offline action log for Supabase replay
 */
db.version(1).stores({
  patients: 'id, name, phone, qr_hash, created_at',
  queue: 'id, patient_id, triage_status, status, created_at',
  inventory: 'id, item_name, quantity, min_threshold, last_updated',
  sync_queue: '++id, table_name, action, timestamp, status'
});

// Helper for generating UUIDs offline
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Seed synthetic data for development & offline testing
export const seedInitialData = async () => {
  const patientCount = await db.patients.count();
  if (patientCount === 0) {
    console.log('Seeding initial synthetic healthcare data into Dexie IndexedDB...');

    const patient1Id = generateUUID();
    const patient2Id = generateUUID();
    const patient3Id = generateUUID();

    const now = new Date().toISOString();

    await db.patients.bulkAdd([
      {
        id: patient1Id,
        name: 'Ramesh Kumar',
        gender: 'Male',
        blood_group: 'O+',
        phone: '+91 9876543210',
        emergency_phone: '+91 9876543211',
        height: 172,
        weight: 68,
        age: 48,
        vitals: { bp: '150/95', spo2: '89%', heartRate: '110 bpm', temp: '99.1°F' },
        notes: '',
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
        height: 158,
        weight: 55,
        age: 34,
        vitals: { bp: '128/82', spo2: '96%', heartRate: '88 bpm', temp: '101.4°F' },
        notes: '',
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
        height: 175,
        weight: 70,
        age: 22,
        vitals: { bp: '120/80', spo2: '99%', heartRate: '72 bpm', temp: '98.6°F' },
        notes: '',
        qr_hash: `AROGYA-${patient3Id.slice(0, 8)}-A+`,
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]);

    await db.queue.bulkAdd([
      {
        id: generateUUID(),
        patient_id: patient1Id,
        triage_status: 'Red',
        survival_info: 'Patient complaining of severe chest tightness and shortness of breath. Immediate doctor review needed.',
        status: 'Waiting',
        age: 48,
        height: 172,
        weight: 68,
        vitals: { bp: '150/95', spo2: '89%', heartRate: '110 bpm', temp: '99.1°F' },
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        patient_id: patient2Id,
        triage_status: 'Yellow',
        survival_info: 'High fever for 3 days, acute fatigue and body pain.',
        status: 'Waiting',
        age: 34,
        height: 158,
        weight: 55,
        vitals: { bp: '128/82', spo2: '96%', heartRate: '88 bpm', temp: '101.4°F' },
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        patient_id: patient3Id,
        triage_status: 'Green',
        survival_info: 'Routine health checkup and vaccine consultation.',
        status: 'Waiting',
        age: 22,
        height: 175,
        weight: 70,
        vitals: { bp: '120/80', spo2: '99%', heartRate: '72 bpm', temp: '98.6°F' },
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date().toISOString()
      }
    ]);

    await db.inventory.bulkAdd([
      {
        id: generateUUID(),
        item_name: 'Paracetamol 500mg Tablets',
        quantity: 450,
        unit: 'tablets',
        min_threshold: 100,
        last_updated: now
      },
      {
        id: generateUUID(),
        item_name: 'Amoxicillin 250mg Capsules',
        quantity: 25,
        unit: 'capsules',
        min_threshold: 50,
        last_updated: now
      },
      {
        id: generateUUID(),
        item_name: 'ORS Packets (Oral Rehydration Solution)',
        quantity: 120,
        unit: 'sachets',
        min_threshold: 40,
        last_updated: now
      },
      {
        id: generateUUID(),
        item_name: 'Rapid Malaria Test Kits',
        quantity: 15,
        unit: 'kits',
        min_threshold: 30,
        last_updated: now
      },
      {
        id: generateUUID(),
        item_name: 'Disposable Syringes (5ml)',
        quantity: 200,
        unit: 'pieces',
        min_threshold: 50,
        last_updated: now
      }
    ]);

    console.log('Synthetic data seeding completed.');
  }
};
