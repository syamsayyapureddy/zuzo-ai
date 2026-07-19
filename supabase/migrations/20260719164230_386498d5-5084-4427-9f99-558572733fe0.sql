
-- 1) Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'));
$$;

-- 4) Policies on user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner reads all roles" ON public.user_roles;
CREATE POLICY "Owner reads all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owner inserts roles" ON public.user_roles;
CREATE POLICY "Owner inserts roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND role <> 'owner');

DROP POLICY IF EXISTS "Owner deletes roles" ON public.user_roles;
CREATE POLICY "Owner deletes roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND role <> 'owner');

-- 5) Seed roles for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role FROM auth.users WHERE email = 'syamsayyapureddy@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'sayyapureddysyam@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role FROM auth.users
WHERE email NOT IN ('syamsayyapureddy@gmail.com', 'sayyapureddysyam@gmail.com')
ON CONFLICT DO NOTHING;

-- 6) Auto-assign 'user' role on signup (extends existing handle_new_user pattern with a separate trigger)
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'syamsayyapureddy@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  ELSIF NEW.email = 'sayyapureddysyam@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_default_role_trigger ON auth.users;
CREATE TRIGGER assign_default_role_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- 7) Replace Knowledge Base policies: only owner+admin
DROP POLICY IF EXISTS "Users view own knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users insert own knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users update own knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users delete own knowledge documents" ON public.knowledge_documents;

CREATE POLICY "Staff view knowledge documents" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (public.is_owner_or_admin(auth.uid()));
CREATE POLICY "Staff insert knowledge documents" ON public.knowledge_documents
  FOR INSERT TO authenticated WITH CHECK (public.is_owner_or_admin(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff update knowledge documents" ON public.knowledge_documents
  FOR UPDATE TO authenticated USING (public.is_owner_or_admin(auth.uid())) WITH CHECK (public.is_owner_or_admin(auth.uid()));
CREATE POLICY "Staff delete knowledge documents" ON public.knowledge_documents
  FOR DELETE TO authenticated USING (public.is_owner_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view own knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users insert own knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users delete own knowledge chunks" ON public.knowledge_chunks;

CREATE POLICY "Staff view knowledge chunks" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (public.is_owner_or_admin(auth.uid()));
CREATE POLICY "Staff insert knowledge chunks" ON public.knowledge_chunks
  FOR INSERT TO authenticated WITH CHECK (public.is_owner_or_admin(auth.uid()));
CREATE POLICY "Staff delete knowledge chunks" ON public.knowledge_chunks
  FOR DELETE TO authenticated USING (public.is_owner_or_admin(auth.uid()));
