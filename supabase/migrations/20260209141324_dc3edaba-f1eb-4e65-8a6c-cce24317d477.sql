-- Grant permissions for all public tables to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motoristas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corridas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrida_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_mensagens TO authenticated;
GRANT SELECT ON public.itens_global TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.itens_bairro_override TO authenticated;
GRANT SELECT ON public.config_global TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.config_bairro TO authenticated;
GRANT SELECT, INSERT ON public.recargas TO authenticated;
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- Anon needs SELECT on bairros (already done) and itens_global for public catalog
GRANT SELECT ON public.itens_global TO anon;