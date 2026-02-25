
-- 1. Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. user_roles: users can read their own roles; admins can manage
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin geral manages roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 3. clientes: own row + admin access
CREATE POLICY "Clientes read own"
  ON public.clientes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_geral') OR public.has_role(auth.uid(), 'admin_bairro'));

CREATE POLICY "Clientes update own"
  ON public.clientes FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clientes insert own"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. motoristas: own row + admin access
CREATE POLICY "Motoristas read own"
  ON public.motoristas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin_geral') OR public.has_role(auth.uid(), 'admin_bairro'));

CREATE POLICY "Motoristas update own"
  ON public.motoristas FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Motoristas insert own"
  ON public.motoristas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5. bairros: readable by all authenticated
CREATE POLICY "Bairros readable"
  ON public.bairros FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages bairros"
  ON public.bairros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 6. config_global: readable by all authenticated
CREATE POLICY "Config global readable"
  ON public.config_global FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages config global"
  ON public.config_global FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 7. config_bairro: readable by authenticated
CREATE POLICY "Config bairro readable"
  ON public.config_bairro FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages config bairro"
  ON public.config_bairro FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role(auth.uid(), 'admin_bairro'));

-- 8. itens_global: readable by authenticated
CREATE POLICY "Itens global readable"
  ON public.itens_global FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages itens global"
  ON public.itens_global FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 9. itens_bairro_override
CREATE POLICY "Itens bairro override readable"
  ON public.itens_bairro_override FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages itens bairro override"
  ON public.itens_bairro_override FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role(auth.uid(), 'admin_bairro'));

-- 10. categorias_itens: readable
CREATE POLICY "Categorias readable"
  ON public.categorias_itens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manages categorias"
  ON public.categorias_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 11. corridas: cliente/motorista own + admin
CREATE POLICY "Corridas select"
  ON public.corridas FOR SELECT TO authenticated
  USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
    OR motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_geral')
    OR public.has_role(auth.uid(), 'admin_bairro')
  );

CREATE POLICY "Corridas insert"
  ON public.corridas FOR INSERT TO authenticated
  WITH CHECK (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));

CREATE POLICY "Corridas update"
  ON public.corridas FOR UPDATE TO authenticated
  USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
    OR motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_geral')
  );

-- 12. corrida_itens
CREATE POLICY "Corrida itens select"
  ON public.corrida_itens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Corrida itens insert"
  ON public.corrida_itens FOR INSERT TO authenticated
  WITH CHECK (true);

-- 13. contra_propostas
CREATE POLICY "Contra propostas select"
  ON public.contra_propostas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Contra propostas insert"
  ON public.contra_propostas FOR INSERT TO authenticated
  WITH CHECK (motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid()));

CREATE POLICY "Contra propostas update"
  ON public.contra_propostas FOR UPDATE TO authenticated
  USING (
    motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_geral')
  );

-- 14. chat_mensagens
CREATE POLICY "Chat mensagens select"
  ON public.chat_mensagens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Chat mensagens insert"
  ON public.chat_mensagens FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid());

-- 15. recargas
CREATE POLICY "Recargas select"
  ON public.recargas FOR SELECT TO authenticated
  USING (
    motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_geral')
  );

CREATE POLICY "Recargas insert"
  ON public.recargas FOR INSERT TO authenticated
  WITH CHECK (motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid()));

CREATE POLICY "Recargas update"
  ON public.recargas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 16. wallet_ledger
CREATE POLICY "Wallet ledger select"
  ON public.wallet_ledger FOR SELECT TO authenticated
  USING (
    motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_geral')
  );

CREATE POLICY "Wallet ledger insert"
  ON public.wallet_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin_geral'));

-- 17. suporte_tickets
CREATE POLICY "Suporte tickets select"
  ON public.suporte_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'suporte') OR public.has_role(auth.uid(), 'admin_geral'));

CREATE POLICY "Suporte tickets insert"
  ON public.suporte_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Suporte tickets update"
  ON public.suporte_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'suporte') OR public.has_role(auth.uid(), 'admin_geral'));

-- 18. suporte_mensagens
CREATE POLICY "Suporte mensagens select"
  ON public.suporte_mensagens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Suporte mensagens insert"
  ON public.suporte_mensagens FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid());

-- 19. push_tokens
CREATE POLICY "Push tokens select own"
  ON public.push_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Push tokens insert own"
  ON public.push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Push tokens delete own"
  ON public.push_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 20. password_reset_tokens: no direct access needed (edge functions use service role)
CREATE POLICY "Password reset tokens no public access"
  ON public.password_reset_tokens FOR SELECT TO authenticated
  USING (false);
