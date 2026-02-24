
-- Add vehicle info to motoristas
ALTER TABLE public.motoristas 
ADD COLUMN IF NOT EXISTS placa text,
ADD COLUMN IF NOT EXISTS tipo_veiculo text,
ADD COLUMN IF NOT EXISTS marca_veiculo text,
ADD COLUMN IF NOT EXISTS cor_veiculo text;

-- Add confirmation codes to corridas
ALTER TABLE public.corridas
ADD COLUMN IF NOT EXISTS codigo_coleta text,
ADD COLUMN IF NOT EXISTS codigo_entrega text;
