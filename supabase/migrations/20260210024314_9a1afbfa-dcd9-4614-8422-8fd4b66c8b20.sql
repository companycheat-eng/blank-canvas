-- Add ajudante columns to corridas table
ALTER TABLE public.corridas
ADD COLUMN com_ajudante boolean NOT NULL DEFAULT false,
ADD COLUMN preco_ajudante numeric NOT NULL DEFAULT 0;