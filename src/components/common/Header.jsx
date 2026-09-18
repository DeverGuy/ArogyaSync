import React from 'react';
import {
  Users, QrCode, Radio, Package, Stethoscope, UserCog,
  Wifi, WifiOff, RefreshCw, LogOut, Activity
} from 'lucide-react';

const TABS = [
  { key: 'queue',     label: 'Smart Queue',   icon: <Users size={16} /> },
  { key: 'qr',        label: 'QR Codes',      icon: <QrCode size={16} /> },
  { key: 'inventory', label: 'Inventory',     icon: <Package size={16} /> },
  { key: 'lora',      label: 'LoRa TX',       icon: <Radio size={16} /> },
  { key: 'duty',      label: 'Duty Roster',   icon: <UserCog size={16} /> }
];

/**
 * Header — ASHA Dashboard navigation bar
 *
 * Props:
 *   activeTab    — currently active tab key
 *   setActiveTab — tab setter
 *   isOnline     — connectivity status
 *   toggleOnline — toggle online/offline simulation
 *   onManualSync — trigger Supabase sync
 *   onSignOut    — sign out handler
 */
export function Header({ activeTab, setActiveTab, isOnline, toggleOnline, onManualSync, onSignOut }) {
  return (
    <header className="glass-panel" style={{ borderRadius: '0 0 16px 16px', marginBottom: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ padding: '12px 20px' }}>

        {/* Top row: branding + connectivity + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>

          {/* Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(13,148,136,0.4)', flexShrink: 0
            }}>
              <Stethoscope size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  ArogyaSync <span style={{ color: '#06b6d4', fontSize: '0.85rem', fontWeight: 600 }}>ASHA</span>
                </h1>
                <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>PHC Node</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                Offline-First Patient Intake & Triage
              </p>
            </div>
          </div>

          {/* Connectivity + Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

            {/* Online/Offline badge (clickable for demo simulation) */}
            <button
              onClick={toggleOnline}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.78rem',
                background: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.15)',
                color: isOnline ? '#6ee7b7' : '#fca5a5'
              }}
            >
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block' }} />
              {isOnline ? 'Online' : 'Offline'}
            </button>

            {/* Manual Sync */}
            {isOnline && (
              <button onClick={onManualSync} className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.78rem', gap: '6px' }}>
                <RefreshCw size={13} /> Sync Now
              </button>
            )}

            {/* Sign Out */}
            {onSignOut && (
              <button onClick={onSignOut} className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.78rem', gap: '6px', color: '#94a3b8' }}>
                <LogOut size={13} /> Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: activeTab === key ? 700 : 500,
                whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                background: activeTab === key
                  ? 'linear-gradient(135deg, rgba(13,148,136,0.35) 0%, rgba(6,182,212,0.25) 100%)'
                  : 'transparent',
                color: activeTab === key ? '#5eead4' : '#64748b',
                borderBottom: activeTab === key ? '2px solid #06b6d4' : '2px solid transparent'
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

      </div>
    </header>
  );
}
