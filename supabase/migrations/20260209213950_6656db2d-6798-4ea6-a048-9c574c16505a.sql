
CREATE OR REPLACE FUNCTION public.corridas_disponiveis_motorista(
  p_motorista_id uuid,
  p_excluir_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS SETOF corridas
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_motorista motoristas%ROWTYPE;
BEGIN
  SELECT * INTO v_motorista FROM motoristas WHERE id = p_motorista_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_motorista.status_kyc != 'aprovado' OR v_motorista.status_online != 'online' THEN RETURN; END IF;

  RETURN QUERY
    SELECT c.*
    FROM corridas c
    WHERE c.status = 'buscando'
      AND c.bairro_id = v_motorista.bairro_id
      AND (v_motorista.aceita_pagamento = 'ambos' OR c.forma_pagamento = v_motorista.aceita_pagamento)
      AND c.id != ALL(p_excluir_ids)
    ORDER BY random()
    LIMIT 3;
END;
$function$;
