
-- Allow clients to see motorista info when they share a corrida
CREATE POLICY "Cliente vê motorista da corrida"
ON public.motoristas
FOR SELECT
USING (
  id IN (
    SELECT corridas.motorista_id FROM corridas
    WHERE corridas.cliente_id IN (
      SELECT clientes.id FROM clientes WHERE clientes.user_id = auth.uid()
    )
    AND corridas.motorista_id IS NOT NULL
    AND corridas.status IN ('aceita','a_caminho','chegou','carregando','em_deslocamento','contra_proposta')
  )
);
