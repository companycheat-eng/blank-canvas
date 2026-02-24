
-- Add cancelado_por to corridas to track who cancelled
ALTER TABLE public.corridas ADD COLUMN IF NOT EXISTS cancelado_por text;

-- Add aceita_pagamento to motoristas (dinheiro, pix, ambos)
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS aceita_pagamento text NOT NULL DEFAULT 'ambos';

-- Add password_reset_tokens table for password recovery
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role should access this table (via edge function)
-- No RLS policies for regular users - tokens are managed server-side only
CREATE POLICY "Service role manages tokens" ON public.password_reset_tokens
  FOR ALL USING (false);
