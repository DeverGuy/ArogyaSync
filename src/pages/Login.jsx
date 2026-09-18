import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Activity, ShieldCheck, ChevronRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      navigate('/asha');
      return;
    }
    
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      setError(signInError.message);
    } else {
      navigate('/asha');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F7F6F3] font-sans selection:bg-[#EAEAEA]">
      <div className="max-w-md w-full px-6">
        
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-16 h-16 border border-[#EAEAEA] rounded-md flex items-center justify-center bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-6">
            <Activity size={32} className="text-[#111111]" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#111111] mb-2">ArogyaSync</h1>
          <p className="text-[#787774] text-sm max-w-[280px] mx-auto">
            Offline-First Patient Intake & Triage System for ASHA Workers
          </p>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">
                Access Code
              </label>
              <input
                type="password"
                disabled
                value="••••••••"
                className="minimal-input bg-[#FBFBFA]"
              />
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
              {loading ? 'Authenticating...' : 'Enter Dashboard'}
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>

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
