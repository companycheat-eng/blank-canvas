-- Add vehicle document URL column to motoristas
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS doc_veiculo_url text;