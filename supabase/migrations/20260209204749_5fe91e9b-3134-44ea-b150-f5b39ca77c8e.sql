-- Add payment method column to corridas
ALTER TABLE public.corridas ADD COLUMN forma_pagamento text NOT NULL DEFAULT 'dinheiro';
