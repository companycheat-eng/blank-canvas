-- Allow admin_geral to insert, update and delete bairros
CREATE POLICY "Admin geral gerencia bairros"
ON public.bairros
FOR ALL
USING (has_role(auth.uid(), 'admin_geral'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_geral'::app_role));
