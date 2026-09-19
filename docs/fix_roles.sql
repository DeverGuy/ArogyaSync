-- Fix incorrect roles assigned in the profiles table
UPDATE public.profiles
SET role = 'asha'
WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE 'asha-%'
);

UPDATE public.profiles
SET role = 'doctor'
WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE 'doc-%'
);
