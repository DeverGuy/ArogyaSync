import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Activity, Radio, QrCode, Package, PlusCircle, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const AshaDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [patientData, setPatientData] = useState({
    name: '',
    blood_group: 'O+',
    gender: 'Male',
    phone: '',
    emergency_phone: '',
    height: '',
    weight: '',
    age: '',
    vitals: { hr: '', bp: '' },
    triage_status: 'Green',
    survival_info: ''
  });
  
  const [qrPayload, setQrPayload] = useState(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  useEffect(() => {
    fetchQueue();
    
    // Subscribe to realtime queue updates
    const subscription = supabase
      .channel('queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchQueue = async () => {
    // We fetch patients via the queue to get their triage status
    const { data, error } = await supabase
      .from('queue')
      .select(`
        id,
        triage_status,
        status,
        patients (id, name, age)
      `)
      .order('created_at', { ascending: false }); // Note: Normally would sort by priority
      
    if (data) {
      // Custom sort: Red > Yellow > Green
      const sorted = [...data].sort((a, b) => {
        const priority = { 'Red': 3, 'Yellow': 2, 'Green': 1 };
        return priority[b.triage_status] - priority[a.triage_status];
      });
      setQueue(sorted);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'hr' || name === 'bp') {
      setPatientData({
        ...patientData,
        vitals: { ...patientData.vitals, [name]: value }
      });
    } else {
      setPatientData({ ...patientData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 1. Insert Patient
    const { data: pData, error: pError } = await supabase
      .from('patients')
      .insert([{
        name: patientData.name,
        blood_group: patientData.blood_group,
        gender: patientData.gender,
        phone: patientData.phone,
        emergency_phone: patientData.emergency_phone,
        height: parseFloat(patientData.height) || null,
        weight: parseFloat(patientData.weight) || null,
        age: parseInt(patientData.age) || null,
        vitals: patientData.vitals
      }])
      .select()
      .single();

    if (pError) {
      console.error('Error inserting patient:', pError);
      alert('Failed to log patient: ' + pError.message);
      return;
    }

    if (pData) {
      // 2. Insert into Queue
      const { error: qError } = await supabase
        .from('queue')
        .insert([{
          patient_id: pData.id,
          triage_status: patientData.triage_status,
          survival_info: patientData.survival_info
        }]);
        
      if (qError) {
        console.error('Error inserting into queue:', qError);
        alert('Failed to add to queue: ' + qError.message);
        return;
      }

      // 3. Generate QR Payload (Simulated 256-byte micro-string)
      const compressedData = `${pData.id.split('-')[0]}|${patientData.triage_status[0]}|${patientData.name.substring(0,10)}`;
      setQrPayload(compressedData);
      
      // Simulate LoRa transmission
      setIsTransmitting(true);
      setTimeout(() => {
        setIsTransmitting(false);
        // Reset form
        setPatientData({
          name: '', blood_group: 'O+', gender: 'Male', phone: '', emergency_phone: '',
          height: '', weight: '', age: '', vitals: { hr: '', bp: '' },
          triage_status: 'Green', survival_info: ''
        });
      }, 2000);
    }
  };

  return (
    <div className="asha-dashboard">
      
      {/* 1. Digital Triage Form */}
      <div className="panel triage-section">
        <h2 className="panel-title"><Activity size={18} style={{marginRight: 8, display:'inline'}}/> Digital Patient Triage</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" className="form-input" name="name" value={patientData.name} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input type="number" className="form-input" name="age" value={patientData.age} onChange={handleInputChange} required />
            </div>
          </div>
          
          <div className="grid-3">
            <div className="form-group">
              <label>Blood Group</label>
              <select className="form-select" name="blood_group" value={patientData.blood_group} onChange={handleInputChange}>
                <option>O+</option><option>O-</option><option>A+</option><option>A-</option>
                <option>B+</option><option>B-</option><option>AB+</option><option>AB-</option>
              </select>
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select className="form-select" name="gender" value={patientData.gender} onChange={handleInputChange}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" className="form-input" name="phone" value={patientData.phone} onChange={handleInputChange} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>HR (bpm)</label>
              <input type="text" className="form-input" name="hr" value={patientData.vitals.hr} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>BP (mmHg)</label>
              <input type="text" className="form-input" name="bp" value={patientData.vitals.bp} onChange={handleInputChange} />
            </div>
          </div>
          
          <div className="form-group">
            <label>Survival / Critical Info</label>
            <textarea className="form-textarea" name="survival_info" rows="2" value={patientData.survival_info} onChange={handleInputChange} placeholder="E.g. Allergic to Penicillin, Snake bite 20 mins ago..."></textarea>
          </div>

          <div className="form-group">
            <label>Triage Priority</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="triage_status" value="Green" checked={patientData.triage_status === 'Green'} onChange={handleInputChange} />
                <span className="badge badge-green">Green (Routine)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="triage_status" value="Yellow" checked={patientData.triage_status === 'Yellow'} onChange={handleInputChange} />
                <span className="badge badge-yellow">Yellow (Urgent)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="triage_status" value="Red" checked={patientData.triage_status === 'Red'} onChange={handleInputChange} />
                <span className="badge badge-red">Red (Critical)</span>
              </label>
            </div>
          </div>

          <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }} disabled={isTransmitting}>
            {isTransmitting ? 'Transmitting Data...' : 'Log Patient & Generate Token'} <PlusCircle size={16} />
          </button>
        </form>
      </div>

      {/* 2. Smart Queue Management */}
      <div className="panel queue-section">
        <h2 className="panel-title"><AlertTriangle size={18} style={{marginRight: 8, display:'inline'}}/> Smart Queue</h2>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {queue.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>Queue is empty.</p>
          ) : (
            queue.map(q => (
              <div key={q.id} className={`patient-card severity-${q.triage_status.toLowerCase()}`}>
                <div className="patient-info">
                  <h3>{q.patients?.name || 'Unknown'} (Age: {q.patients?.age || 'N/A'})</h3>
                  <p>Status: {q.status}</p>
                </div>
                <div>
                  <span className={`badge badge-${q.triage_status.toLowerCase()}`}>{q.triage_status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. QR Generation & LoRa Comms */}
      <div className="panel system-section">
        <div className="grid-2" style={{ height: '100%' }}>
          
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem', display: 'flex', flexDirection: 'column' }}>
            <h2 className="panel-title"><QrCode size={18} style={{marginRight: 8, display:'inline'}}/> Offline QR Token</h2>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              {qrPayload ? (
                <>
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '4px', marginBottom: '1rem' }}>
                    <QRCodeSVG value={qrPayload} size={150} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Payload: {qrPayload}</p>
                </>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>No token generated.</p>
              )}
            </div>
          </div>

          <div style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column' }}>
            <h2 className="panel-title"><Radio size={18} style={{marginRight: 8, display:'inline'}}/> LoRa Transmission</h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem' }}>Bandwidth Limit:</span>
                <span className="badge badge-yellow">256 bytes/tx</span>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '1rem', background: 'var(--bg-color)' }}>
                {isTransmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)' }}>
                    <Radio className="lucide-pulse" />
                    <span>Transmitting High-Priority Packet...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Radio />
                    <span>Radio Idle. Ready.</span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AshaDashboard;
