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
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

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
      setSyncToast(`Synced ${result.syncedCount} offline record(s) to Supabase.`);
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
    <div className="min-h-[100dvh] pb-24 bg-white text-[#111111]">
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

      <div className="max-w-5xl mx-auto px-6">
        {/* Sync Toast */}
        <AnimatePresence>
          {syncToast && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 flex items-center justify-center"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-[#EDF3EC] border border-[#EDF3EC] text-[#346538] text-sm rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
                <CheckCircle2 size={16} />
                {syncToast}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'queue'     && <QueueManager onSelectQR={handleSelectQR} />}
              {activeTab === 'qr'        && <QRGenerator initialPatientId={selectedQRPatientId} />}
              {activeTab === 'inventory' && <InventoryManager />}
              {activeTab === 'lora'      && <LoRaSelector />}
              {activeTab === 'duty'      && <DoctorDutyManager />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
