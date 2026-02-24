
-- Add columns to recargas for PIX payment tracking
ALTER TABLE public.recargas 
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_copia_cola text;
