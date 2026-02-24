
CREATE OR REPLACE FUNCTION public.cancelar_corrida_motorista(p_corrida_id uuid, p_motorista_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_taxa_creditos NUMERIC;
  v_preco_original NUMERIC;
BEGIN
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  
  IF v_corrida.status NOT IN ('aceita', 'a_caminho', 'chegou', 'carregando') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não é possível cancelar neste status');
  END IF;
  
  IF v_corrida.motorista_id != p_motorista_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não é o motorista desta corrida');
  END IF;

  -- Refund debited credits
  v_taxa_creditos := COALESCE(v_corrida.taxa_creditos_debitada, 0);
  IF v_taxa_creditos > 0 THEN
    UPDATE motoristas SET saldo_creditos = saldo_creditos + v_taxa_creditos WHERE id = p_motorista_id;
    INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo, ref_id)
    VALUES (p_motorista_id, 'credito', v_taxa_creditos, 'Estorno - motorista cancelou', p_corrida_id);
  END IF;

  -- Recalculate original price from components
  v_preco_original := v_corrida.preco_itens + v_corrida.preco_km + CASE WHEN v_corrida.com_ajudante THEN v_corrida.preco_ajudante ELSE 0 END;

  -- Return ride to buscando with original price restored
  UPDATE corridas SET 
    status = 'buscando',
    motorista_id = NULL,
    taxa_pct_usada = NULL,
    taxa_creditos_debitada = NULL,
    preco_total_estimado = v_preco_original
  WHERE id = p_corrida_id;

  -- Reject any pending proposals from this motorista
  UPDATE contra_propostas SET status = 'recusada' 
  WHERE corrida_id = p_corrida_id AND motorista_id = p_motorista_id AND status = 'pendente';

  RETURN jsonb_build_object('ok', true, 'creditos_devolvidos', v_taxa_creditos);
END;
$function$;
