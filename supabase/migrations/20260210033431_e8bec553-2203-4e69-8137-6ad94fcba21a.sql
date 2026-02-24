
-- Add nota_referencia to contra_propostas for denormalization
ALTER TABLE public.contra_propostas ADD COLUMN motorista_nota numeric NOT NULL DEFAULT 5.0;

-- Update enviar_contra_proposta to include nota
CREATE OR REPLACE FUNCTION public.enviar_contra_proposta(p_corrida_id uuid, p_motorista_id uuid, p_valor numeric)
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
  v_already_proposed BOOLEAN;
  v_limites JSONB;
  v_min_pct NUMERIC;
  v_max_pct NUMERIC;
  v_min_valor NUMERIC;
  v_max_valor NUMERIC;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM corridas 
    WHERE motorista_id = p_motorista_id 
    AND status IN ('aceita', 'a_caminho', 'chegou', 'carregando', 'em_deslocamento')
  ) INTO v_has_active;
  
  IF v_has_active THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você já tem uma corrida em andamento');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM contra_propostas 
    WHERE corrida_id = p_corrida_id AND motorista_id = p_motorista_id AND status = 'pendente'
  ) INTO v_already_proposed;
  
  IF v_already_proposed THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você já enviou uma proposta para esta corrida');
  END IF;

  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status != 'buscando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não está mais disponível'); END IF;

  SELECT * INTO v_motorista FROM motoristas WHERE id = p_motorista_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;
  IF v_motorista.status_kyc != 'aprovado' THEN RETURN jsonb_build_object('ok', false, 'erro', 'KYC não aprovado'); END IF;
  IF v_motorista.bairro_id != v_corrida.bairro_id THEN RETURN jsonb_build_object('ok', false, 'erro', 'Bairro diferente'); END IF;

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

  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  v_taxa_estimada := ROUND(p_valor * v_taxa_pct / 100, 2);
  IF v_motorista.saldo_creditos < v_taxa_estimada THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo insuficiente. Necessário: R$ ' || v_taxa_estimada::text, 'necessario', v_taxa_estimada, 'saldo', v_motorista.saldo_creditos);
  END IF;

  INSERT INTO contra_propostas (corrida_id, motorista_id, valor, motorista_nome, motorista_placa, motorista_veiculo, motorista_foto_url, motorista_nota)
  VALUES (p_corrida_id, p_motorista_id, p_valor, v_motorista.nome, v_motorista.placa, 
    COALESCE(v_motorista.marca_veiculo, '') || CASE WHEN v_motorista.cor_veiculo IS NOT NULL THEN ' ' || v_motorista.cor_veiculo ELSE '' END,
    v_motorista.foto_url, v_motorista.nota_referencia);

  RETURN jsonb_build_object('ok', true, 'min', ROUND(v_min_valor, 2), 'max', ROUND(v_max_valor, 2));
END;
$function$;
