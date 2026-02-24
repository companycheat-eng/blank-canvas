-- Add status/suspension columns to clientes
ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS suspenso_ate timestamp with time zone;

-- Add suspension column to motoristas (block already exists via status_kyc)
ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS suspenso_ate timestamp with time zone;

-- Update RLS for clientes to allow admin delete (soft-delete via status)
-- No new policies needed since admins already have UPDATE on clientes