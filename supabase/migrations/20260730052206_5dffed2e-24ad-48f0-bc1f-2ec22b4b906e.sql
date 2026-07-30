CREATE TABLE public.breed_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  primary_breed text,
  alternative_breeds jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence integer,
  analysis text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.breed_scans TO authenticated;
GRANT ALL ON public.breed_scans TO service_role;

ALTER TABLE public.breed_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own breed scans" ON public.breed_scans
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX breed_scans_user_created_idx ON public.breed_scans(user_id, created_at DESC);