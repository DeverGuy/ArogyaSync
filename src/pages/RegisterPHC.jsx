import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Activity, Building2, KeyRound, ChevronRight, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';

export default function RegisterPHC() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [city, setCity] = useState('');
  const [phcNo, setPhcNo] = useState('');
  const [password, setPassword] = useState('123456');
  const [secretKey, setSecretKey] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Demo mode does not support registration.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Verify Secret Key
      const { data: keyData, error: keyError } = await supabase
        .from('secret_key')
        .select('key')
        .eq('key', secretKey)
        .single();
        
      if (keyError || !keyData) {
        setError('Invalid registration code. Please enter the correct government-issued key.');
        setLoading(false);
        return;
      }

      // 2. Fetch coordinates from Nominatim
      let latitude = null;
      let longitude = null;
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`);
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          latitude = parseFloat(geoData[0].lat);
          longitude = parseFloat(geoData[0].lon);
        }
      } catch (err) {
        console.warn('Could not fetch coordinates for city', err);
      }

      // 3. Register PHC in database
      const cityPrefix = city.trim().substring(0, 3).toUpperCase();
      const phcId = `PHC-${cityPrefix}-${phcNo.trim()}`;

      const { error: phcInsertError } = await supabase
        .from('phcs')
        .insert([{
          id: phcId,
          name: city.trim(),
          latitude,
          longitude,
          is_active: true
        }]);

      if (phcInsertError) {
        setError(`Failed to create PHC record: ${phcInsertError.message}`);
        setLoading(false);
        return;
      }

      // 4. Register Auth Account
      const email = `asha-${phcId.toLowerCase()}@arogyasync.com`;
      
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'asha',
            full_name: `PHC ${city.trim()}`,
            phc_id: phcId,
            plain_password: password
          }
        }
      });
      
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err) {
      setError('An unexpected error occurred during registration.');
      console.error(err);
    }
    
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F7F6F3] font-sans">
        <div className="max-w-md w-full px-6 text-center">
          <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col items-center">
            <div className="w-16 h-16 bg-[#F2FCE2] text-[#4D7C0F] rounded-full flex items-center justify-center mb-4">
              <Building2 size={32} />
            </div>
            <h2 className="text-xl font-serif text-[#111111] mb-2">Registration Successful</h2>
            <p className="text-[#787774] text-sm mb-6">
              PHC {phcNo} has been successfully registered. You can now log in using the PHC credentials.
            </p>
            <p className="text-xs text-[#787774]">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F7F6F3] font-sans selection:bg-[#EAEAEA] py-12">
      <div className="max-w-md w-full px-6">
        
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center text-xs font-bold text-[#787774] hover:text-[#111111] transition-colors uppercase tracking-widest">
            <ArrowLeft size={14} className="mr-1" /> Back to Login
          </Link>
        </div>

        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 border border-[#EAEAEA] rounded-md flex items-center justify-center bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-6">
            <Activity size={32} className="text-[#111111]" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#111111] mb-2">Register PHC</h1>
          <p className="text-[#787774] text-sm max-w-[280px] mx-auto">
            Authorized onboarding for new Primary Health Centres
          </p>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <form onSubmit={handleRegister} className="space-y-6">
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bangalore"
                  required
                  className="minimal-input bg-[#FBFBFA]"
                />
              </div>

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

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#787774] uppercase tracking-widest">
                  Account Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  minLength={6}
                  maxLength={6}
                  required
                  className="minimal-input bg-[#FBFBFA]"
                />
                <p className="text-[10px] text-[#787774]">
                  Must be exactly 6 characters (default: 123456).
                </p>
              </div>

              <div className="pt-2 pb-1">
                <div className="h-px bg-[#EAEAEA] w-full"></div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-[#111111] uppercase tracking-widest">
                  <KeyRound size={14} className="text-[#787774]" />
                  Registration Code
                </label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Enter government-issued key"
                  required
                  className="minimal-input bg-[#FBFBFA] border-[#111111] focus:ring-[#111111]"
                />
              </div>
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
              {loading ? 'Verifying...' : 'Register PHC'}
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>

        </div>
        
        <div className="text-center mt-8 text-xs text-[#787774]">
          Secure Local Node • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
