
-- Add client name/photo to corridas for denormalized access
ALTER TABLE public.corridas ADD COLUMN IF NOT EXISTS cliente_nome text NOT NULL DEFAULT '';
ALTER TABLE public.corridas ADD COLUMN IF NOT EXISTS cliente_foto_url text;
