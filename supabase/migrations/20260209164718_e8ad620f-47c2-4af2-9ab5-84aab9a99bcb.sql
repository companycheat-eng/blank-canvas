
-- Create categories table
CREATE TABLE public.categorias_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  icone text DEFAULT 'package',
  ordem integer DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categorias_itens ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see categories
CREATE POLICY "Categorias visíveis por autenticados"
ON public.categorias_itens
FOR SELECT
USING (true);

-- Admin geral manages categories
CREATE POLICY "Admin geral gerencia categorias"
ON public.categorias_itens
FOR ALL
USING (has_role(auth.uid(), 'admin_geral'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_geral'::app_role));

-- Add categoria_id to itens_global
ALTER TABLE public.itens_global ADD COLUMN categoria_id uuid REFERENCES public.categorias_itens(id);

-- Insert default categories
INSERT INTO public.categorias_itens (nome, icone, ordem) VALUES
  ('Sala', 'sofa', 1),
  ('Cozinha', 'cooking-pot', 2),
  ('Quarto', 'bed-double', 3),
  ('Eletrônicos', 'monitor', 4),
  ('Equipamentos', 'wrench', 5),
  ('Festa', 'party-popper', 6),
  ('Outros', 'package', 99);
