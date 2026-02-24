CREATE OR REPLACE FUNCTION public.cancelar_corrida_cliente(p_corrida_id uuid, p_cliente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_taxa_creditos NUMERIC;
BEGIN
  -- Lock corrida
  SELECT * INTO v_corrida FROM corridas WHERE id = p_corrida_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  
  IF v_corrida.cliente_id != p_cliente_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não é o cliente desta corrida');
  END IF;

  -- Only allow cancellation before delivery
  IF v_corrida.status NOT IN ('buscando', 'aceita', 'a_caminho', 'chegou', 'carregando') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não é possível cancelar neste status');
  END IF;

  -- Refund driver credits if a driver had accepted
  IF v_corrida.motorista_id IS NOT NULL THEN
    v_taxa_creditos := COALESCE(v_corrida.taxa_creditos_debitada, 0);
    IF v_taxa_creditos > 0 THEN
      UPDATE motoristas SET saldo_creditos = saldo_creditos + v_taxa_creditos WHERE id = v_corrida.motorista_id;
      INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo, ref_id)
      VALUES (v_corrida.motorista_id, 'credito', v_taxa_creditos, 'Estorno - cliente cancelou', p_corrida_id);
    END IF;
  END IF;

  -- Cancel ride
  UPDATE corridas SET 
    status = 'cancelada',
    cancelado_por = 'cliente'
  WHERE id = p_corrida_id;

  -- Reject pending proposals
  UPDATE contra_propostas SET status = 'recusada' 
  WHERE corrida_id = p_corrida_id AND status = 'pendente';

  RETURN jsonb_build_object('ok', true, 'creditos_devolvidos', COALESCE(v_taxa_creditos, 0));
END;
$$;