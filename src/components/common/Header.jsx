import React from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Users, 
  UserPlus, 
  QrCode, 
  Package, 
  Radio, 
  Stethoscope 
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';

export function Header({ activeTab, setActiveTab, isOnline, toggleOnline, onManualSync }) {
  const pendingSyncItems = useLiveQuery(() =>
    db.sync_queue.where('status').equals('PENDING').count()
  , []) || 0;

  const totalPatientsInQueue = useLiveQuery(() =>
    db.queue.where('status').equals('Waiting').count()
  , []) || 0;

  return (
    <header className="glass-panel" style={{ borderRadius: '0 0 16px 16px', marginBottom: '24px' }}>
      <div className="container" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Logo & Platform Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(13, 148, 136, 0.4)'
            }}>
              <Stethoscope size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  ArogyaSync <span style={{ color: '#06b6d4', fontSize: '0.9rem', fontWeight: 600 }}>ASHA PHC</span>
                </h1>
                <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Agent 1</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                Smart Triage & Offline Queue Management
              </p>
            </div>
          </div>

          {/* Status & Sync Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            
            {/* Live Queue Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              <Users size={14} color="#06b6d4" />
              <span>Queue: <strong style={{ color: '#f8fafc' }}>{totalPatientsInQueue} waiting</strong></span>
            </div>

            {/* Offline Sync Queue Indicator */}
            {pendingSyncItems > 0 && (
              <button 
                onClick={onManualSync}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px', borderColor: 'var(--triage-yellow-border)', color: 'var(--triage-yellow-text)' }}
                title="Click to sync offline items"
              >
                <RefreshCw size={13} className="animate-spin" />
                <span>{pendingSyncItems} Unsynced Events</span>
              </button>
            )}

            {/* Network Mode Status & Simulation Switch */}
            <button 
              onClick={toggleOnline}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                gap: '8px',
                background: isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)',
                color: isOnline ? '#6ee7b7' : '#fca5a5'
              }}
            >
              {isOnline ? (
                <>
                  <Wifi size={15} color="#10b981" />
                  <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
                  <span>ONLINE (Realtime)</span>
                </>
              ) : (
                <>
                  <WifiOff size={15} color="#ef4444" />
                  <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}></span>
                  <span>OFFLINE (Dead-Zone Mode)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', gap: '8px', marginTop: '18px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', overflowX: 'auto' }}>
          {[
            { id: 'queue', label: 'Smart Queue', icon: Users, badge: totalPatientsInQueue },
            { id: 'triage', label: 'New Patient & Triage', icon: UserPlus },
            { id: 'qr', label: 'Offline QR Generator', icon: QrCode },
            { id: 'inventory', label: 'PHC Stock', icon: Package },
            { id: 'lora', label: 'LoRa Transmission', icon: Radio }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="btn"
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%)' : 'transparent',
                  color: isActive ? '#f8fafc' : 'var(--text-muted)',
                  borderColor: isActive ? 'var(--primary)' : 'transparent',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} color={isActive ? '#06b6d4' : 'var(--text-muted)'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{
                    background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    marginLeft: '4px'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
