
-- Table for multiple counter-proposals per ride
CREATE TABLE public.contra_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id uuid NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES public.motoristas(id),
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  motorista_nome text NOT NULL DEFAULT '',
  motorista_placa text,
  motorista_veiculo text,
  motorista_foto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contra_propostas ENABLE ROW LEVEL SECURITY;

-- Cliente sees proposals for their rides
CREATE POLICY "Cliente vê propostas da corrida"
  ON public.contra_propostas FOR SELECT
  USING (corrida_id IN (
    SELECT id FROM corridas WHERE cliente_id IN (
      SELECT id FROM clientes WHERE user_id = auth.uid()
    )
  ));

-- Motorista sees own proposals
CREATE POLICY "Motorista vê próprias propostas"
  ON public.contra_propostas FOR SELECT
  USING (motorista_id IN (
    SELECT id FROM motoristas WHERE user_id = auth.uid()
  ));

-- Admin sees all
CREATE POLICY "Admins veem propostas"
  ON public.contra_propostas FOR SELECT
  USING (has_role(auth.uid(), 'admin_geral'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contra_propostas;

-- RPC: Send counter-proposal (multiple allowed, validates limits)
CREATE OR REPLACE FUNCTION public.enviar_contra_proposta(p_corrida_id uuid, p_motorista_id uuid, p_valor numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_motorista motoristas%ROWTYPE;
  v_taxa_pct NUMERIC;
  v_taxa_estimada NUMERIC;
  v_config_value JSONB;
  v_has_active BOOLEAN;
  v_already_proposed BOOLEAN;
  v_limites JSONB;
  v_min_pct NUMERIC;
  v_max_pct NUMERIC;
  v_min_valor NUMERIC;
  v_max_valor NUMERIC;
BEGIN
  -- Check if motorista already has an active ride
  SELECT EXISTS(
    SELECT 1 FROM corridas 
    WHERE motorista_id = p_motorista_id 
    AND status IN ('aceita', 'a_caminho', 'chegou', 'carregando', 'em_deslocamento')
  ) INTO v_has_active;
  
  IF v_has_active THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você já tem uma corrida em andamento');
  END IF;

  -- Check if already proposed for this ride
  SELECT EXISTS(
    SELECT 1 FROM contra_propostas 
    WHERE corrida_id = p_corrida_id AND motorista_id = p_motorista_id AND status = 'pendente'
  ) INTO v_already_proposed;
  
  IF v_already_proposed THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você já enviou uma proposta para esta corrida');
  END IF;

  -- Get corrida
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status != 'buscando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não está mais disponível'); END IF;

  -- Check motorista
  SELECT * INTO v_motorista FROM motoristas WHERE id = p_motorista_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;
  IF v_motorista.status_kyc != 'aprovado' THEN RETURN jsonb_build_object('ok', false, 'erro', 'KYC não aprovado'); END IF;
  IF v_motorista.bairro_id != v_corrida.bairro_id THEN RETURN jsonb_build_object('ok', false, 'erro', 'Bairro diferente'); END IF;

  -- Get limits config
  SELECT value INTO v_limites FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'contra_proposta_limites';
  IF v_limites IS NULL THEN
    SELECT value INTO v_limites FROM config_global WHERE key = 'contra_proposta_limites';
  END IF;
  v_min_pct := COALESCE((v_limites->>'min_pct')::NUMERIC, -30);
  v_max_pct := COALESCE((v_limites->>'max_pct')::NUMERIC, 30);

  v_min_valor := v_corrida.preco_total_estimado * (1 + v_min_pct / 100);
  v_max_valor := v_corrida.preco_total_estimado * (1 + v_max_pct / 100);

  IF p_valor < v_min_valor OR p_valor > v_max_valor THEN
    RETURN jsonb_build_object('ok', false, 'erro', 
      'Valor deve estar entre R$ ' || ROUND(v_min_valor, 2)::text || ' e R$ ' || ROUND(v_max_valor, 2)::text,
      'min', ROUND(v_min_valor, 2), 'max', ROUND(v_max_valor, 2));
  END IF;

  -- Get taxa config for balance check
  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  v_taxa_estimada := ROUND(p_valor * v_taxa_pct / 100, 2);
  IF v_motorista.saldo_creditos < v_taxa_estimada THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo insuficiente. Necessário: R$ ' || v_taxa_estimada::text, 'necessario', v_taxa_estimada, 'saldo', v_motorista.saldo_creditos);
  END IF;

  -- Insert proposal with motorista info
  INSERT INTO contra_propostas (corrida_id, motorista_id, valor, motorista_nome, motorista_placa, motorista_veiculo, motorista_foto_url)
  VALUES (p_corrida_id, p_motorista_id, p_valor, v_motorista.nome, v_motorista.placa, 
    COALESCE(v_motorista.marca_veiculo, '') || CASE WHEN v_motorista.cor_veiculo IS NOT NULL THEN ' ' || v_motorista.cor_veiculo ELSE '' END,
    v_motorista.foto_url);

  RETURN jsonb_build_object('ok', true, 'min', ROUND(v_min_valor, 2), 'max', ROUND(v_max_valor, 2));
END;
$$;

-- RPC: Accept a specific proposal
CREATE OR REPLACE FUNCTION public.aceitar_contra_proposta(p_corrida_id uuid, p_proposta_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_proposta contra_propostas%ROWTYPE;
  v_motorista motoristas%ROWTYPE;
  v_taxa_pct NUMERIC;
  v_taxa_creditos NUMERIC;
  v_config_value JSONB;
BEGIN
  -- Lock corrida
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status != 'buscando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não está mais disponível'); END IF;

  -- Get proposal
  IF p_proposta_id IS NOT NULL THEN
    SELECT * INTO v_proposta FROM contra_propostas WHERE id = p_proposta_id AND corrida_id = p_corrida_id AND status = 'pendente' FOR UPDATE;
  ELSE
    -- Legacy: get from corrida fields
    RETURN jsonb_build_object('ok', false, 'erro', 'ID da proposta é obrigatório');
  END IF;
  
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Proposta não encontrada ou já processada'); END IF;

  -- Lock motorista
  SELECT * INTO v_motorista FROM motoristas WHERE id = v_proposta.motorista_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;

  -- Get taxa config
  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  v_taxa_creditos := ROUND(v_proposta.valor * v_taxa_pct / 100, 2);

  IF v_motorista.saldo_creditos < v_taxa_creditos THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Motorista sem saldo suficiente');
  END IF;

  -- Debit credits
  UPDATE motoristas SET saldo_creditos = saldo_creditos - v_taxa_creditos WHERE id = v_motorista.id;
  INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo, ref_id) 
  VALUES (v_motorista.id, 'debito', v_taxa_creditos, 'Taxa corrida aceita (contra-proposta)', p_corrida_id);

  -- Accept ride
  UPDATE corridas SET 
    motorista_id = v_proposta.motorista_id,
    status = 'aceita',
    preco_total_estimado = v_proposta.valor,
    taxa_pct_usada = v_taxa_pct,
    taxa_creditos_debitada = v_taxa_creditos
  WHERE id = p_corrida_id;

  -- Mark this proposal as accepted, others as recusada
  UPDATE contra_propostas SET status = 'aceita' WHERE id = p_proposta_id;
  UPDATE contra_propostas SET status = 'recusada' WHERE corrida_id = p_corrida_id AND id != p_proposta_id AND status = 'pendente';

  RETURN jsonb_build_object('ok', true, 'taxa_creditos', v_taxa_creditos);
END;
$$;

-- Insert default global config for limits
INSERT INTO public.config_global (key, value, descricao) 
VALUES ('contra_proposta_limites', '{"min_pct": -30, "max_pct": 30}'::jsonb, 'Limites % mínimo e máximo para contra-propostas')
ON CONFLICT (key) DO NOTHING;
