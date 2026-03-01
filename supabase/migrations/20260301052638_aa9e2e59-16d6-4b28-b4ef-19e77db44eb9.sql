-- Permitir que admin_geral e admin_bairro atualizem registros de motoristas (aprovação KYC, suspensão, edição etc.)
DROP POLICY IF EXISTS "Admin can update motoristas" ON public.motoristas;

CREATE POLICY "Admin can update motoristas"
ON public.motoristas
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
);