DROP FUNCTION IF EXISTS public.corridas_disponiveis_motorista(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.corridas_disponiveis_motorista(p_motorista_id uuid, p_excluir_ids uuid[])
 RETURNS SETOF corridas
 LANGUAGE sql
 STABLE
AS $function$
  SELECT c.*
  FROM public.corridas c
  JOIN public.motoristas m ON m.id = p_motorista_id
  WHERE (c.status = 'buscando' OR c.status = 'contra_proposta')
    AND c.bairro_id = m.bairro_id
    AND c.id != ALL(p_excluir_ids)
  ORDER BY random()
  LIMIT 3;
$function$;