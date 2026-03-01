-- Temporarily disable auth validation triggers to allow cleanup of orphaned data
ALTER TABLE public.motoristas DISABLE TRIGGER trg_motoristas_validate_auth_user;
ALTER TABLE public.motoristas DISABLE TRIGGER trg_motoristas_prevent_duplicate_user_id;
ALTER TABLE public.user_roles DISABLE TRIGGER trg_user_roles_validate_auth_user;

-- Orphaned motorista IDs
-- 0e0f3a03 (igor belo), abbb0766 (icaro cruz), 37f7f2e5 (abadias galicia), 83259aaf (icaro cruz)

-- Clean wallet_ledger referencing orphaned motoristas
DELETE FROM public.wallet_ledger WHERE motorista_id IN (
  '0e0f3a03-2a3b-4321-b602-1edc3f3f06ba',
  'abbb0766-bc9a-4956-8a93-54f17e4d958c',
  '37f7f2e5-4021-4165-a464-82d11db1ce6b',
  '83259aaf-cf11-4cd0-ac8e-5b818a40c5b0'
);

-- Clean contra_propostas
DELETE FROM public.contra_propostas WHERE motorista_id IN (
  '0e0f3a03-2a3b-4321-b602-1edc3f3f06ba',
  'abbb0766-bc9a-4956-8a93-54f17e4d958c',
  '37f7f2e5-4021-4165-a464-82d11db1ce6b',
  '83259aaf-cf11-4cd0-ac8e-5b818a40c5b0'
);

-- Clean chat_mensagens for corridas that reference orphaned motoristas
DELETE FROM public.chat_mensagens WHERE corrida_id IN (
  SELECT id FROM public.corridas WHERE motorista_id IN (
    '0e0f3a03-2a3b-4321-b602-1edc3f3f06ba',
    'abbb0766-bc9a-4956-8a93-54f17e4d958c',
    '37f7f2e5-4021-4165-a464-82d11db1ce6b',
    '83259aaf-cf11-4cd0-ac8e-5b818a40c5b0'
  )
);

-- Clean corrida_itens for corridas that reference orphaned motoristas
DELETE FROM public.corrida_itens WHERE corrida_id IN (
  SELECT id FROM public.corridas WHERE motorista_id IN (
    '0e0f3a03-2a3b-4321-b602-1edc3f3f06ba',
    'abbb0766-bc9a-4956-8a93-54f17e4d958c',
    '37f7f2e5-4021-4165-a464-82d11db1ce6b',
    '83259aaf-cf11-4cd0-ac8e-5b818a40c5b0'
  )
);

-- Unlink corridas from orphaned motoristas (set motorista_id to NULL instead of deleting)
UPDATE public.corridas SET motorista_id = NULL, status = 'cancelada', cancelado_por = 'sistema'
WHERE motorista_id IN (
  '0e0f3a03-2a3b-4321-b602-1edc3f3f06ba',
  'abbb0766-bc9a-4956-8a93-54f17e4d958c',
  '37f7f2e5-4021-4165-a464-82d11db1ce6b',
  '83259aaf-cf11-4cd0-ac8e-5b818a40c5b0'
);

-- Delete orphaned motoristas
DELETE FROM public.motoristas WHERE id IN (
  '0e0f3a03-2a3b-4321-b602-1edc3f3f06ba',
  'abbb0766-bc9a-4956-8a93-54f17e4d958c',
  '37f7f2e5-4021-4165-a464-82d11db1ce6b',
  '83259aaf-cf11-4cd0-ac8e-5b818a40c5b0'
);

-- Delete orphaned user_roles
DELETE FROM public.user_roles WHERE user_id IN (
  'bc0076de-8f86-49ba-b83d-6c27aeab0853',
  '95892ceb-ec75-4f7b-a2bc-a74e650f81fb',
  '1844311c-4761-4b26-b656-ba752923f14d',
  '1254b7c9-146d-4400-bb4d-296c1047c2d5'
);

-- Re-enable triggers
ALTER TABLE public.motoristas ENABLE TRIGGER trg_motoristas_validate_auth_user;
ALTER TABLE public.motoristas ENABLE TRIGGER trg_motoristas_prevent_duplicate_user_id;
ALTER TABLE public.user_roles ENABLE TRIGGER trg_user_roles_validate_auth_user;