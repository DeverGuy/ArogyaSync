import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Stethoscope, UserCheck, Activity } from 'lucide-react';

export function AppNav() {
  const location = useLocation();

  return (
    <div className="sticky top-0 z-[100] bg-white border-b border-[#EAEAEA]">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between py-4 gap-4">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md border border-[#EAEAEA] flex items-center justify-center bg-[#FBFBFA]">
            <Activity size={16} className="text-[#111111]" />
          </div>
          <span className="font-serif font-medium text-lg text-[#111111] tracking-tight">
            ArogyaSync
          </span>
        </div>

        {/* Dashboard Role Switcher */}
        <nav className="flex gap-4">
          <NavLink
            to="/asha"
            className={({ isActive }) => `
              flex items-center gap-2 text-sm font-medium transition-colors
              ${(isActive || location.pathname === '/') 
                ? 'text-[#111111]' 
                : 'text-[#787774] hover:text-[#111111]'}
            `}
          >
            <UserCheck size={14} />
            <span className="hidden sm:inline">ASHA</span>
          </NavLink>
          <NavLink
            to="/doctor"
            className={({ isActive }) => `
              flex items-center gap-2 text-sm font-medium transition-colors
              ${isActive 
                ? 'text-[#111111]' 
                : 'text-[#787774] hover:text-[#111111]'}
            `}
          >
            <Stethoscope size={14} />
            Doctor
          </NavLink>
        </nav>

      </div>
    </div>
  );
}
