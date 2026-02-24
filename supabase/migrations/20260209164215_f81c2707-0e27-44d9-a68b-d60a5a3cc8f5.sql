
-- Allow clients to update their own corridas (for cancellation)
CREATE POLICY "Cliente atualiza própria corrida"
ON public.corridas
FOR UPDATE
USING (
  cliente_id IN (
    SELECT clientes.id FROM clientes WHERE clientes.user_id = auth.uid()
  )
)
WITH CHECK (
  cliente_id IN (
    SELECT clientes.id FROM clientes WHERE clientes.user_id = auth.uid()
  )
);
