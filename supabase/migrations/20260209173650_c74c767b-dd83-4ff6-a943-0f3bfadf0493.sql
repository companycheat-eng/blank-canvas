
-- Function: client accepts contra-proposta, ride becomes "aceita" atomically with credit debit
CREATE OR REPLACE FUNCTION public.aceitar_contra_proposta(p_corrida_id uuid)
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
BEGIN
  -- Lock corrida
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status != 'contra_proposta' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não está em contra-proposta'); END IF;
  IF v_corrida.motorista_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado na corrida'); END IF;

  -- Lock motorista
  SELECT * INTO v_motorista FROM motoristas WHERE id = v_corrida.motorista_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;

  -- Get taxa config (bairro override or global)
  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  -- Calculate credits based on contra-proposta value
  v_taxa_creditos := ROUND(v_corrida.contra_proposta_valor * v_taxa_pct / 100, 2);

  -- Check balance
  IF v_motorista.saldo_creditos < v_taxa_creditos THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Motorista sem saldo suficiente');
  END IF;

  -- Debit credits
  UPDATE motoristas SET saldo_creditos = saldo_creditos - v_taxa_creditos WHERE id = v_motorista.id;
  INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo, ref_id) 
  VALUES (v_motorista.id, 'debito', v_taxa_creditos, 'Taxa corrida aceita (contra-proposta)', p_corrida_id);

  -- Accept ride with contra-proposta value
  UPDATE corridas SET 
    status = 'aceita',
    preco_total_estimado = v_corrida.contra_proposta_valor,
    taxa_pct_usada = v_taxa_pct,
    taxa_creditos_debitada = v_taxa_creditos
  WHERE id = p_corrida_id;

  RETURN jsonb_build_object('ok', true, 'taxa_creditos', v_taxa_creditos);
END;
$function$;
