
-- Function: motorista can see client of their active ride
CREATE OR REPLACE FUNCTION public.motorista_pode_ver_cliente(_user_id uuid, _cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM corridas c
    JOIN motoristas m ON m.id = c.motorista_id
    WHERE m.user_id = _user_id
      AND c.cliente_id = _cliente_id
      AND c.status IN ('aceita', 'a_caminho', 'chegou', 'carregando', 'em_deslocamento', 'contra_proposta')
  )
$$;

-- Allow driver to see client of their active ride
CREATE POLICY "Motorista vê cliente da corrida"
ON public.clientes
FOR SELECT
USING (motorista_pode_ver_cliente(auth.uid(), id));
