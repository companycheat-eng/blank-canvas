
-- Create a SECURITY DEFINER function to check if a client can see a motorista
-- This avoids infinite recursion between motoristas and corridas RLS policies
CREATE OR REPLACE FUNCTION public.cliente_pode_ver_motorista(_user_id uuid, _motorista_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM corridas c
    JOIN clientes cl ON cl.id = c.cliente_id
    WHERE cl.user_id = _user_id
      AND c.motorista_id = _motorista_id
      AND c.status IN ('aceita', 'a_caminho', 'chegou', 'carregando', 'em_deslocamento', 'contra_proposta')
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Cliente vê motorista da corrida" ON public.motoristas;

-- Recreate it using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Cliente vê motorista da corrida"
ON public.motoristas
FOR SELECT
USING (
  public.cliente_pode_ver_motorista(auth.uid(), id)
);
