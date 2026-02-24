-- Add flag to indicate a bairro entry covers the entire city
ALTER TABLE public.bairros ADD COLUMN cidade_inteira boolean NOT NULL DEFAULT false;