import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * ProtectedRoute
 *
 * Wraps a route and enforces:
 *  1. User must be authenticated (Supabase session exists)
 *  2. User's role (from profiles table) must match the `requiredRole` prop
 *
 * When Supabase is NOT configured (demo mode), this passes through freely —
 * any role is accepted so developers can explore without a backend.
 *
 * Props:
 *   children     — the component to render if authorized
 *   requiredRole — 'asha' | 'doctor' (optional; if omitted, any role is allowed)
 */
export function ProtectedRoute({ children, requiredRole }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied' | 'wrong-role'

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('allowed');
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setStatus('denied');
        return;
      }

      if (!requiredRole) {
        setStatus('allowed');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === requiredRole) {
        setStatus('allowed');
      } else {
        setStatus('wrong-role');
      }
    });
  }, [requiredRole]);

  if (status === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(13,148,136,0.3)', borderTopColor: '#0d9488',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Verifying credentials…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === 'denied') return <Navigate to="/login" replace />;
  if (status === 'wrong-role') {
    // Redirect to the correct dashboard for the user's actual role
    return <Navigate to="/login" replace />;
  }

  return children;
}
