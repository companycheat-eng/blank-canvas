-- Delete dependent records for cliente Ricardo (3e73444c-...)
DELETE FROM public.chat_mensagens WHERE corrida_id IN (
  SELECT id FROM public.corridas WHERE cliente_id = '3e73444c-72c8-42e9-9e27-30aef343a896'
);
DELETE FROM public.corrida_itens WHERE corrida_id IN (
  SELECT id FROM public.corridas WHERE cliente_id = '3e73444c-72c8-42e9-9e27-30aef343a896'
);
DELETE FROM public.contra_propostas WHERE corrida_id IN (
  SELECT id FROM public.corridas WHERE cliente_id = '3e73444c-72c8-42e9-9e27-30aef343a896'
);
DELETE FROM public.corridas WHERE cliente_id = '3e73444c-72c8-42e9-9e27-30aef343a896';
DELETE FROM public.suporte_mensagens WHERE ticket_id IN (
  SELECT id FROM public.suporte_tickets WHERE user_id = '0694b3de-30d1-431a-ab98-53438be8645e'
);
DELETE FROM public.suporte_tickets WHERE user_id = '0694b3de-30d1-431a-ab98-53438be8645e';
DELETE FROM public.clientes WHERE id = '3e73444c-72c8-42e9-9e27-30aef343a896';