-- Permitir leitura anônima em tabelas de referência para cadastro sem login
-- categorias_itens
CREATE POLICY "Anon can read categorias_itens"
ON public.categorias_itens
FOR SELECT
TO anon
USING (ativo = true);

-- itens_global
CREATE POLICY "Anon can read itens_global"
ON public.itens_global
FOR SELECT
TO anon
USING (ativo = true);

-- config_global (para taxa_pct etc)
CREATE POLICY "Anon can read config_global"
ON public.config_global
FOR SELECT
TO anon
USING (true);

-- config_bairro
CREATE POLICY "Anon can read config_bairro"
ON public.config_bairro
FOR SELECT
TO anon
USING (true);