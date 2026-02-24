-- Drop the restrictive policy and recreate as permissive
DROP POLICY "Bairros visíveis por todos" ON public.bairros;

CREATE POLICY "Bairros visíveis por todos"
ON public.bairros
FOR SELECT
TO public
USING (true);