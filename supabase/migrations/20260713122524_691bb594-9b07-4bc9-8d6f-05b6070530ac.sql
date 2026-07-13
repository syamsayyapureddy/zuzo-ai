CREATE POLICY "Users can view their own contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid());