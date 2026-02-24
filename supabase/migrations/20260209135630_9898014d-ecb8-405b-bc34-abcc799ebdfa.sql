-- Drop existing policy and allow public read of bairros
DROP POLICY "Bairros visíveis por todos autenticados" ON public.bairros;
CREATE POLICY "Bairros visíveis por todos" ON public.bairros FOR SELECT USING (true);