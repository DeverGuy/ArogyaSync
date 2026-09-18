import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/common/Header';
import { QueueManager } from '../components/asha/QueueManager';
import { QRGenerator } from '../components/asha/QRGenerator';
import { InventoryManager } from '../components/asha/InventoryManager';
import { LoRaSelector } from '../components/asha/LoRaSelector';
import { DoctorDutyManager } from '../components/asha/DoctorDutyManager';
import { seedInitialData } from '../lib/db';
import { replaySyncQueue } from '../lib/syncManager';
import { isSupabaseConfigured, supabase, signOut } from '../lib/supabase';

/**
 * ASHA Worker Dashboard (PHC Node)
 *
 * Offline-first dashboard for frontline ASHA workers at the Primary Health Centre.
 *
 * Tabs:
 *   queue     → Smart Queue Management (triage-sorted patient list, includes Intake modal)
 *   qr        → QR Code Generation (offline-readable patient cards)
 *   inventory → PHC Stock & Inventory Management
 *   lora      → LoRa Transmission Control (Python backend)
 *   duty      → Doctor Duty Roster (who is on duty today)
 */
export default function AshaDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]             = useState('queue');
  const [isOnline, setIsOnline]               = useState(navigator.onLine);
  const [selectedQRPatientId, setSelectedQRPatientId] = useState('');
  const [syncToast, setSyncToast]             = useState('');

  useEffect(() => {
    seedInitialData();

    const handleOnline = () => {
      setIsOnline(true);
      handleManualSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    const result = await replaySyncQueue();
    if (result?.syncedCount > 0) {
      setSyncToast(`✅ Synced ${result.syncedCount} offline record(s) to Supabase.`);
      setTimeout(() => setSyncToast(''), 4000);
    }
  };

  const handleSelectQR = (patientId) => {
    setSelectedQRPatientId(patientId);
    setActiveTab('qr');
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured) await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        toggleOnline={() => {
          const next = !isOnline;
          setIsOnline(next);
          if (next) handleManualSync();
        }}
        onManualSync={handleManualSync}
        onSignOut={handleSignOut}
      />

      {/* Sync Toast */}
      {syncToast && (
        <div className="container" style={{ marginBottom: '16px' }}>
          <div style={{
            padding: '12px 18px',
            background: 'rgba(6,182,212,0.2)', border: '1px solid #06b6d4',
            borderRadius: '12px', color: '#67e8f9',
            fontSize: '0.88rem', textAlign: 'center'
          }}>
            {syncToast}
          </div>
        </div>
      )}

      <main className="container">
        {activeTab === 'queue'     && <QueueManager onSelectQR={handleSelectQR} />}
        {activeTab === 'qr'        && <QRGenerator initialPatientId={selectedQRPatientId} />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'lora'      && <LoRaSelector />}
        {activeTab === 'duty'      && <DoctorDutyManager />}
      </main>
    </div>
  );
}
