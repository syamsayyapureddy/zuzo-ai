ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS breed_confidence integer,
  ADD COLUMN IF NOT EXISTS last_breed_scan_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS alternative_breeds text;