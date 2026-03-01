-- ============================================================
-- AUDITORIA COMPLETA DE RLS - Políticas faltantes
-- ============================================================

-- 1. CLIENTES: Admin precisa fazer UPDATE (editar, bloquear, suspender, excluir)
DROP POLICY IF EXISTS "Admin can update clientes" ON public.clientes;

CREATE POLICY "Admin can update clientes"
ON public.clientes
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

-- 2. SUPORTE_TICKETS: Adicionar admin_bairro ao UPDATE
DROP POLICY IF EXISTS "Suporte tickets update" ON public.suporte_tickets;

CREATE POLICY "Suporte tickets update"
ON public.suporte_tickets
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'suporte'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
);

-- 3. SUPORTE_TICKETS: Admin/suporte leem todos os tickets
DROP POLICY IF EXISTS "Suporte tickets select" ON public.suporte_tickets;

CREATE POLICY "Suporte tickets select"
ON public.suporte_tickets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'suporte'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
);

-- 4. SUPORTE_MENSAGENS: Suporte/admin INSERT em qualquer ticket
DROP POLICY IF EXISTS "Suporte admin can insert mensagens" ON public.suporte_mensagens;

CREATE POLICY "Suporte admin can insert mensagens"
ON public.suporte_mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'suporte'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_geral'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
  )
);

-- 5. SUPORTE_MENSAGENS: Suporte/admin leem todas as mensagens
DROP POLICY IF EXISTS "Suporte admin can read all mensagens" ON public.suporte_mensagens;

CREATE POLICY "Suporte admin can read all mensagens"
ON public.suporte_mensagens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'suporte'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
);

-- 6. CORRIDAS: Admin DELETE
DROP POLICY IF EXISTS "Admin can delete corridas" ON public.corridas;

CREATE POLICY "Admin can delete corridas"
ON public.corridas
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_geral'::public.app_role)
);

-- 7. STORAGE: Admin lê KYC docs (usando storage.objects diretamente)
DROP POLICY IF EXISTS "Admin can read kyc files" ON storage.objects;

CREATE POLICY "Admin can read kyc files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    public.has_role(auth.uid(), 'admin_geral'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bairro'::public.app_role)
  )
);