CREATE OR REPLACE FUNCTION public.enviar_contra_proposta(p_corrida_id uuid, p_motorista_id uuid, p_valor double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_corrida public.corridas;
  v_motorista public.motoristas;
BEGIN
  SELECT * INTO v_corrida FROM public.corridas WHERE id = p_corrida_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não encontrada'); END IF;
  IF v_corrida.status NOT IN ('buscando', 'contra_proposta') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Corrida não aceita propostas');
  END IF;

  SELECT * INTO v_motorista FROM public.motoristas WHERE id = p_motorista_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;

  INSERT INTO public.contra_propostas (corrida_id, motorista_id, valor, motorista_nome, motorista_nota, motorista_placa, motorista_veiculo, motorista_foto_url)
  VALUES (p_corrida_id, p_motorista_id, p_valor, v_motorista.nome, v_motorista.nota_referencia, v_motorista.placa, v_motorista.marca_veiculo, v_motorista.foto_url);

  UPDATE public.corridas 
  SET status = 'contra_proposta', 
      contra_proposta_at = now(), 
      updated_at = now() 
  WHERE id = p_corrida_id 
    AND status IN ('buscando', 'contra_proposta');

  RETURN jsonb_build_object('ok', true);
END;
$function$;