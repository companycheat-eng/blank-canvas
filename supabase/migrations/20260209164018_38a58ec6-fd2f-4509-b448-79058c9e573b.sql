
-- Function for motorista to send counter-proposal (bypasses RLS since SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.enviar_contra_proposta(
  p_corrida_id uuid,
  p_motorista_id uuid,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_motorista motoristas%ROWTYPE;
  v_taxa_pct NUMERIC;
  v_taxa_estimada NUMERIC;
  v_config_value JSONB;
  v_has_active BOOLEAN;
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

  -- Lock corrida
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status != 'buscando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não está mais disponível'); END IF;

  -- Check motorista
  SELECT * INTO v_motorista FROM motoristas WHERE id = p_motorista_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;
  IF v_motorista.status_kyc != 'aprovado' THEN RETURN jsonb_build_object('ok', false, 'erro', 'KYC não aprovado'); END IF;
  IF v_motorista.bairro_id != v_corrida.bairro_id THEN RETURN jsonb_build_object('ok', false, 'erro', 'Bairro diferente'); END IF;

  -- Get taxa config
  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  -- Check balance for the proposed value
  v_taxa_estimada := ROUND(p_valor * v_taxa_pct / 100, 2);
  IF v_motorista.saldo_creditos < v_taxa_estimada THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo insuficiente. Necessário: R$ ' || v_taxa_estimada::text, 'necessario', v_taxa_estimada, 'saldo', v_motorista.saldo_creditos);
  END IF;

  -- Update corrida with counter-proposal
  UPDATE corridas SET 
    motorista_id = p_motorista_id,
    status = 'contra_proposta',
    contra_proposta_valor = p_valor,
    contra_proposta_at = now()
  WHERE id = p_corrida_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- Also update aceitar_corrida to block duplicate accepts
CREATE OR REPLACE FUNCTION public.aceitar_corrida(p_corrida_id uuid, p_motorista_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_motorista motoristas%ROWTYPE;
  v_taxa_pct NUMERIC;
  v_taxa_creditos NUMERIC;
  v_config_value JSONB;
  v_has_active BOOLEAN;
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

  -- Lock corrida
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status != 'buscando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida já aceita ou finalizada'); END IF;

  -- Check motorista
  SELECT * INTO v_motorista FROM motoristas WHERE id = p_motorista_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;
  IF v_motorista.status_kyc != 'aprovado' THEN RETURN jsonb_build_object('ok', false, 'erro', 'KYC não aprovado'); END IF;
  IF v_motorista.status_online != 'online' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista offline'); END IF;
  IF v_motorista.bairro_id != v_corrida.bairro_id THEN RETURN jsonb_build_object('ok', false, 'erro', 'Bairro diferente'); END IF;

  -- Get taxa config (bairro override or global)
  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  -- Calculate credits to debit
  v_taxa_creditos := ROUND(v_corrida.preco_total_estimado * v_taxa_pct / 100, 2);

  -- Check balance
  IF v_motorista.saldo_creditos < v_taxa_creditos THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo insuficiente. Recarregue créditos.', 'necessario', v_taxa_creditos, 'saldo', v_motorista.saldo_creditos);
  END IF;

  -- Debit credits
  UPDATE motoristas SET saldo_creditos = saldo_creditos - v_taxa_creditos WHERE id = p_motorista_id;
  INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo, ref_id) VALUES (p_motorista_id, 'debito', v_taxa_creditos, 'Taxa corrida aceita', p_corrida_id);

  -- Accept ride
  UPDATE corridas SET motorista_id = p_motorista_id, status = 'aceita', taxa_pct_usada = v_taxa_pct, taxa_creditos_debitada = v_taxa_creditos WHERE id = p_corrida_id;

  RETURN jsonb_build_object('ok', true, 'taxa_creditos', v_taxa_creditos);
END;
$function$;
