import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-arogyasync.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Get the current authenticated user's profile (role, name, specialty).
 * Profile is stored in the 'profiles' table in Supabase.
 * Returns null if not authenticated or Supabase is not configured.
 */
export const getCurrentProfile = async () => {
  if (!isSupabaseConfigured) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.warn('[Supabase] Could not fetch profile:', error.message);
    return null;
  }
  return data;
};

/**
 * Sign in with email + password.
 * Returns { user, profile, error }
 */
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, profile: null, error: error.message };

  const profile = await getCurrentProfile();
  return { user: data.user, profile, error: null };
};

/**
 * Sign out the current user.
 */
export const signOut = async () => {
  await supabase.auth.signOut();
};

/**
 * Subscribe to auth state changes (login/logout).
 */
export const onAuthChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
