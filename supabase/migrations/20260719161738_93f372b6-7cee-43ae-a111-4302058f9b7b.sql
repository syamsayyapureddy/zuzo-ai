
CREATE TABLE public.pets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  date_of_birth DATE,
  age_text TEXT,
  gender TEXT,
  weight_kg NUMERIC(6,2),
  color TEXT,
  microchip_id TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  vaccination_status TEXT,
  notes TEXT,
  photo_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;
GRANT ALL ON public.pets TO service_role;

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pets" ON public.pets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pets" ON public.pets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pets" ON public.pets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own pets" ON public.pets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX pets_user_id_idx ON public.pets(user_id);

CREATE TRIGGER pets_set_updated_at
BEFORE UPDATE ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_single_default_pet()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.pets SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pets_single_default
AFTER INSERT OR UPDATE OF is_default ON public.pets
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.enforce_single_default_pet();

-- Storage policies for pet photos in the existing/new 'pet-photos' bucket (created via tool)
