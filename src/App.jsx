import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { QueueManager } from './components/asha/QueueManager';
import { TriageForm } from './components/asha/TriageForm';
import { QRGenerator } from './components/asha/QRGenerator';
import { InventoryManager } from './components/asha/InventoryManager';
import { LoRaSelector } from './components/asha/LoRaSelector';
import { seedInitialData } from './lib/db';
import { replaySyncQueue } from './lib/syncManager';

export function App() {
  const [activeTab, setActiveTab] = useState('queue');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedQRPatientId, setSelectedQRPatientId] = useState('');
  const [syncToast, setSyncToast] = useState('');

  useEffect(() => {
    // Seed synthetic data for local offline testing on initial launch
    seedInitialData();

    const handleOnline = () => {
      setIsOnline(true);
      handleManualSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleOnlineSimulation = () => {
    const newState = !isOnline;
    setIsOnline(newState);
    if (newState) {
      handleManualSync();
    }
  };

  const handleManualSync = async () => {
    const result = await replaySyncQueue();
    if (result && result.syncedCount > 0) {
      setSyncToast(`Successfully synced ${result.syncedCount} offline record(s) to Supabase!`);
      setTimeout(() => setSyncToast(''), 4000);
    }
  };

  const handleSelectQR = (patientId) => {
    setSelectedQRPatientId(patientId);
    setActiveTab('qr');
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        toggleOnline={toggleOnlineSimulation}
        onManualSync={handleManualSync}
      />

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="container" style={{ marginBottom: '16px' }}>
          <div style={{
            padding: '12px 18px',
            background: 'rgba(6, 182, 212, 0.2)',
            border: '1px solid #06b6d4',
            borderRadius: '12px',
            color: '#67e8f9',
            fontSize: '0.88rem',
            textAlign: 'center'
          }}>
            ✨ {syncToast}
          </div>
        </div>
      )}

      {/* Tab Views Container */}
      <main className="container">
        {activeTab === 'queue' && (
          <QueueManager
            onSelectQR={handleSelectQR}
            onNavigateIntake={() => setActiveTab('triage')}
          />
        )}

        {activeTab === 'triage' && (
          <TriageForm
            isOnline={isOnline}
            onTriageComplete={() => setActiveTab('queue')}
          />
        )}

        {activeTab === 'qr' && (
          <QRGenerator
            initialPatientId={selectedQRPatientId}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager />
        )}

        {activeTab === 'lora' && (
          <LoRaSelector />
        )}
      </main>

    </div>
  );
}

export default App;
