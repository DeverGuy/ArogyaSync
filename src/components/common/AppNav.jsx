import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Stethoscope, UserCheck, Activity } from 'lucide-react';

/**
 * AppNav — Top-level navigation bar for switching between dashboards.
 * This lives above the per-dashboard headers so both dashboards are always reachable.
 * It is intentionally minimal: just the app brand + two role links.
 */
export function AppNav() {
  const location = useLocation();

  const navLinkStyle = (isActive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '7px 18px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: isActive ? 700 : 500,
    textDecoration: 'none',
    background: isActive
      ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%)'
      : 'transparent',
    color: isActive ? '#f8fafc' : 'var(--text-muted)',
    border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap'
  });

  return (
    <div style={{
      background: 'rgba(9, 13, 22, 0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', gap: '16px' }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity size={18} color="#fff" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            ArogyaSync
          </span>
        </div>

        {/* Dashboard Role Switcher */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          <NavLink
            to="/asha"
            style={({ isActive }) => navLinkStyle(isActive || location.pathname === '/')}
          >
            <UserCheck size={15} />
            ASHA / PHC Worker
          </NavLink>
          <NavLink
            to="/doctor"
            style={({ isActive }) => navLinkStyle(isActive)}
          >
            <Stethoscope size={15} />
            Doctor
          </NavLink>
        </nav>

      </div>
    </div>
  );
}
