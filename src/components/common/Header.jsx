import React from 'react';
import {
  Users, QrCode, Radio, Package, Stethoscope, UserCog,
  Wifi, WifiOff, RefreshCw, LogOut, Cpu
} from 'lucide-react';
import { motion } from 'motion/react';

const TABS = [
  { key: 'queue',     label: 'Smart Queue',   icon: <Users size={16} /> },
  { key: 'qr',        label: 'QR Codes',      icon: <QrCode size={16} /> },
  { key: 'inventory', label: 'Inventory',     icon: <Package size={16} /> },
  { key: 'lora',      label: 'LoRa TX',       icon: <Radio size={16} /> },
  { key: 'duty',      label: 'Duty Roster',   icon: <UserCog size={16} /> },
  { key: 'gateway',   label: 'Gateway RX',    icon: <Cpu size={16} /> }
];

export function Header({ activeTab, setActiveTab, isOnline, toggleOnline, onManualSync, onSignOut }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-xl border-b border-[#EAEAEA] mb-12">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
          
          {/* Branding */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-[#EAEAEA] rounded-md flex items-center justify-center shrink-0">
              <Stethoscope size={20} className="text-[#111111]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-medium tracking-tight text-[#111111] m-0 leading-none">ArogyaSync</h1>
                <span className="px-2 py-0.5 rounded-full bg-[#F7F6F3] text-[#787774] border border-[#EAEAEA] text-[10px] font-bold uppercase tracking-widest">
                  ASHA Node
                </span>
              </div>
              <p className="text-sm text-[#787774] mt-1 leading-none">Offline-First Patient Intake & Triage</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={toggleOnline}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors shrink-0 ${
                isOnline 
                  ? 'bg-[#EDF3EC] border-[#EDF3EC] text-[#346538] hover:bg-[#E3EFE2]' 
                  : 'bg-[#FDEBEC] border-[#FDEBEC] text-[#9F2F2D] hover:bg-[#FADBDC]'
              }`}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#346538]' : 'bg-[#9F2F2D]'} animate-pulse`} />
              {isOnline ? 'Online' : 'Offline'}
            </button>

            {isOnline && (
              <button 
                onClick={onManualSync} 
                className="btn-minimal-outline flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              >
                <RefreshCw size={14} /> 
                <span>Sync</span>
              </button>
            )}

            {onSignOut && (
              <button 
                onClick={onSignOut} 
                className="btn-minimal-outline flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#787774] hover:text-[#111111]"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-px">
          {TABS.map(({ key, label, icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex items-center gap-2 pb-4 text-sm font-medium transition-colors shrink-0 ${
                  isActive ? 'text-[#111111]' : 'text-[#787774] hover:text-[#111111]'
                }`}
              >
                {icon}
                {label}
                {isActive && (
                  <motion.div 
                    layoutId="header-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#111111]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
