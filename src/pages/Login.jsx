import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, signIn, isSupabaseConfigured } from '../lib/supabase';
import { Stethoscope, Lock, Mail, AlertCircle, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';

/**
 * Login Page
 *
 * Authenticates via Supabase Auth.
 * After login, fetches the user's profile.role ('asha' | 'doctor') and
 * redirects them to the appropriate dashboard.
 *
 * Offline fallback: If Supabase is not configured, provides demo credentials
 * that bypass auth and route directly to the selected dashboard.
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoRole, setDemoRole] = useState('');

  // If user is already signed in, redirect them
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from('profiles').select('role').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.role === 'doctor') navigate('/doctor', { replace: true });
            else navigate('/asha', { replace: true });
          });
      }
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { user, profile, error: authError } = await signIn(email, password);

      if (authError) {
        setError(authError);
        return;
      }

      if (!profile) {
        setError('Account exists but no role assigned. Contact your PHC administrator.');
        return;
      }

      if (profile.role === 'doctor') navigate('/doctor', { replace: true });
      else navigate('/asha', { replace: true });

    } catch (err) {
      setError('Unexpected error. Please try again.');
      console.error('[Login]', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Demo mode: bypass auth when Supabase is not configured
  const handleDemoAccess = (role) => {
    setDemoRole(role);
    setTimeout(() => {
      if (role === 'asha') navigate('/asha', { replace: true });
      else navigate('/doctor', { replace: true });
    }, 600);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(13, 148, 136, 0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.04) 0%, transparent 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(13, 148, 136, 0.4)'
          }}>
            <Stethoscope size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
            ArogyaSync
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
            SIH26133 · Rural PHC Healthcare Management
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '12px', padding: '4px 12px',
            background: isSupabaseConfigured ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${isSupabaseConfigured ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: '20px', fontSize: '0.72rem',
            color: isSupabaseConfigured ? '#6ee7b7' : '#fde047'
          }}>
            {isSupabaseConfigured ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isSupabaseConfigured ? 'Connected to Supabase' : 'Demo Mode — No Backend Required'}
          </div>
        </div>

        {/* Login Panel */}
        <div className="glass-panel" style={{ padding: '32px' }}>

          {isSupabaseConfigured ? (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '24px', textAlign: 'center' }}>
                Sign in to your account
              </h2>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', marginBottom: '20px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px', fontSize: '0.85rem', color: '#fca5a5'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      className="input-field"
                      placeholder="doctor@phc.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{ paddingLeft: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingLeft: '38px', paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem', justifyContent: 'center' }}
                >
                  {isLoading ? 'Authenticating…' : 'Sign In'}
                </button>
              </form>
            </>
          ) : (
            /* ── Demo Mode UI (no Supabase configured) ── */
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', textAlign: 'center' }}>
                Demo Mode
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>
                No backend configured. Select your role to explore the dashboard with synthetic data.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={() => handleDemoAccess('asha')}
                  className="btn btn-secondary"
                  style={{
                    padding: '16px', fontSize: '0.95rem', justifyContent: 'flex-start', gap: '14px',
                    background: demoRole === 'asha' ? 'rgba(13,148,136,0.2)' : undefined,
                    borderColor: demoRole === 'asha' ? 'var(--primary)' : undefined,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(13,148,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    👩‍⚕️
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>ASHA Worker / PHC Staff</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Triage, Queue, QR, Inventory, LoRa</div>
                  </div>
                </button>

                <button
                  onClick={() => handleDemoAccess('doctor')}
                  className="btn btn-secondary"
                  style={{
                    padding: '16px', fontSize: '0.95rem', justifyContent: 'flex-start', gap: '14px',
                    background: demoRole === 'doctor' ? 'rgba(6,182,212,0.15)' : undefined,
                    borderColor: demoRole === 'doctor' ? '#06b6d4' : undefined,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    🩺
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>Doctor / Medical Officer</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Queue Monitor, Patient Vitals, Records</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#334155', marginTop: '20px' }}>
          ArogyaSync · SIH 2026 · Offline-First Rural Healthcare
        </p>
      </div>
    </div>
  );
}
