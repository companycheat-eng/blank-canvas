-- Allow admins to update client records
CREATE POLICY "Admins atualizam clientes"
ON public.clientes
FOR UPDATE
USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role_in_bairro(auth.uid(), 'admin_bairro'::app_role, bairro_id))
WITH CHECK (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role_in_bairro(auth.uid(), 'admin_bairro'::app_role, bairro_id));
