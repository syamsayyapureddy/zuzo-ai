CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  source_page TEXT NOT NULL DEFAULT '/contact',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT ALL ON public.contact_submissions TO service_role;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL AND auth.uid() IS NULL)
    OR (user_id = auth.uid())
  );

CREATE TRIGGER contact_submissions_set_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();