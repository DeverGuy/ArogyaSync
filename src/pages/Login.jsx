import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { isSupabaseConfigured, signIn } from '../lib/supabase';
import { Activity, ShieldCheck, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [role, setRole] = useState('asha'); // 'asha' or 'doctor'
  const [phcNo, setPhcNo] = useState('');
  const [doctorNo, setDoctorNo] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      navigate(role === 'doctor' ? '/doctor' : '/asha');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Construct synthetic email based on role and numbers
    const cleanPhc = phcNo.trim();
    const cleanDoc = doctorNo.trim();
    
    localStorage.setItem('current_phc', cleanPhc);
    
    const email = role === 'asha' 
      ? `asha-${cleanPhc}@arogyasync.com` 
      : `doc-${cleanPhc}-${cleanDoc}@arogyasync.com`;
    
    const { user, profile, error: signInError } = await signIn(email, password);
    
    if (signInError) {
      setError(signInError);
    } else {
      // Navigate based on profile role if available, fallback to selected role
      if (profile?.role === 'doctor' || role === 'doctor') {
        navigate('/doctor');
      } else {
        navigate('/asha');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F7F6F3] font-sans selection:bg-[#EAEAEA]">
      <div className="max-w-md w-full px-6">
        
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 border border-[#EAEAEA] rounded-md flex items-center justify-center bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-6">
            <Activity size={32} className="text-[#111111]" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#111111] mb-2">ArogyaSync</h1>
          <p className="text-[#787774] text-sm max-w-[280px] mx-auto">
            Offline-First Patient Intake & Triage System
          </p>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          
          <div className="flex bg-[#FBFBFA] p-1 rounded-md mb-6 border border-[#EAEAEA]">
            <button
              type="button"
              onClick={() => setRole('asha')}
              className={clsx(
                "flex-1 text-xs font-bold uppercase tracking-wider py-2 rounded-sm transition-colors",
                role === 'asha' ? "bg-white text-[#111111] shadow-sm border border-[#EAEAEA]" : "text-[#787774] hover:text-[#111111]"
              )}
            >
              ASHA Worker
            </button>
            <button
              type="button"
              onClick={() => setRole('doctor')}
              className={clsx(
                "flex-1 text-xs font-bold uppercase tracking-wider py-2 rounded-sm transition-colors",
                role === 'doctor' ? "bg-white text-[#111111] shadow-sm border border-[#EAEAEA]" : "text-[#787774] hover:text-[#111111]"
              )}
            >
              Doctor
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">
                  PHC Number
                </label>
                <input
                  type="text"
                  value={phcNo}
                  onChange={(e) => setPhcNo(e.target.value)}
                  placeholder="e.g. 1042"
                  required
                  className="minimal-input bg-[#FBFBFA]"
                />
              </div>

              {role === 'doctor' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">
                    Doctor Number
                  </label>
                  <input
                    type="text"
                    value={doctorNo}
                    onChange={(e) => setDoctorNo(e.target.value)}
                    placeholder="e.g. 05"
                    required
                    className="minimal-input bg-[#FBFBFA]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="minimal-input bg-[#FBFBFA]"
                />
              </div>
              
              <p className="text-[10px] text-[#787774] flex items-center gap-1 mt-2">
                <ShieldCheck size={12} /> Local offline encryption enabled
              </p>
            </div>

            {error && (
              <div className="p-3 bg-[#FDEBEC] border border-[#FDEBEC] rounded-md text-[#9F2F2D] text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-minimal w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? 'Authenticating...' : 'Secure Sign In'}
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>

          {role === 'asha' && (
            <div className="mt-4 text-center">
              <p className="text-xs text-[#787774]">
                New Primary Health Centre?{' '}
                <Link to="/register-phc" className="font-bold text-[#111111] hover:underline">
                  Register here
                </Link>
              </p>
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="mt-6 pt-6 border-t border-[#EAEAEA] text-center">
              <p className="text-xs text-[#9F2F2D] font-medium bg-[#FDEBEC] inline-block px-2 py-1 rounded-sm">
                Demo Mode: Sync Disabled
              </p>
            </div>
          )}
        </div>
        
        <div className="text-center mt-8 text-xs text-[#787774]">
          Secure Local Node • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
