-- Add counter-proposal fields to corridas
ALTER TABLE public.corridas 
  ADD COLUMN IF NOT EXISTS contra_proposta_valor numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contra_proposta_at timestamptz DEFAULT NULL;

-- Add new status values for the proposal flow
-- Current enum: buscando, aceita, a_caminho, chegou, carregando, em_deslocamento, finalizada, cancelada
-- We need: contra_proposta (driver counter-proposed), recusada_cliente (client rejected counter)
ALTER TYPE public.corrida_status ADD VALUE IF NOT EXISTS 'contra_proposta';
ALTER TYPE public.corrida_status ADD VALUE IF NOT EXISTS 'recusada_cliente';
