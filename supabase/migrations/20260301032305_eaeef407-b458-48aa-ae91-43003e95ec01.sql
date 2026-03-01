-- Compatibilidade de autenticação + carregamento de bairros em telas públicas
-- 1) RLS de bairros: permitir leitura pública apenas de bairros ativos (cadastro sem login)
DROP POLICY IF EXISTS "Authenticated users can read bairros" ON public.bairros;
DROP POLICY IF EXISTS "Bairros readable" ON public.bairros;

CREATE POLICY "Anon can read active bairros"
ON public.bairros
FOR SELECT
TO anon
USING (ativo = true);

CREATE POLICY "Authenticated can read active bairros"
ON public.bairros
FOR SELECT
TO authenticated
USING (
  ativo = true
  OR public.has_role(auth.uid(), 'admin_geral')
  OR public.has_role(auth.uid(), 'admin_bairro')
);

-- 2) Índice para acelerar filtros de estado/cidade/bairro no cadastro
CREATE INDEX IF NOT EXISTS idx_bairros_ativo_estado_cidade_nome
  ON public.bairros (ativo, estado, cidade, nome);

-- 3) Constraints de integridade para evitar ambiguidade de login/perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_cpf_key'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_cpf_key UNIQUE (cpf);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_telefone_key'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_telefone_key UNIQUE (telefone);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'motoristas_cpf_key'
      AND conrelid = 'public.motoristas'::regclass
  ) THEN
    ALTER TABLE public.motoristas
      ADD CONSTRAINT motoristas_cpf_key UNIQUE (cpf);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'motoristas_telefone_key'
      AND conrelid = 'public.motoristas'::regclass
  ) THEN
    ALTER TABLE public.motoristas
      ADD CONSTRAINT motoristas_telefone_key UNIQUE (telefone);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- 4) Guard-rails para impedir novas quebras de vínculo com auth.users
CREATE OR REPLACE FUNCTION public.validate_user_id_exists_in_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'user_id % não existe em auth.users', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_validate_auth_user ON public.clientes;
CREATE TRIGGER trg_clientes_validate_auth_user
BEFORE INSERT OR UPDATE OF user_id ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_id_exists_in_auth();

DROP TRIGGER IF EXISTS trg_motoristas_validate_auth_user ON public.motoristas;
CREATE TRIGGER trg_motoristas_validate_auth_user
BEFORE INSERT OR UPDATE OF user_id ON public.motoristas
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_id_exists_in_auth();

DROP TRIGGER IF EXISTS trg_user_roles_validate_auth_user ON public.user_roles;
CREATE TRIGGER trg_user_roles_validate_auth_user
BEFORE INSERT OR UPDATE OF user_id ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_id_exists_in_auth();

-- 5) Evitar novos perfis duplicados por user_id (sem mexer nos dados atuais)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_profile_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'clientes' THEN
    IF EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.user_id = NEW.user_id
        AND c.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Já existe cliente vinculado a este user_id';
    END IF;
  ELSIF TG_TABLE_NAME = 'motoristas' THEN
    IF EXISTS (
      SELECT 1
      FROM public.motoristas m
      WHERE m.user_id = NEW.user_id
        AND m.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Já existe motorista vinculado a este user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_prevent_duplicate_user_id ON public.clientes;
CREATE TRIGGER trg_clientes_prevent_duplicate_user_id
BEFORE INSERT OR UPDATE OF user_id ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_profile_user_id();

DROP TRIGGER IF EXISTS trg_motoristas_prevent_duplicate_user_id ON public.motoristas;
CREATE TRIGGER trg_motoristas_prevent_duplicate_user_id
BEFORE INSERT OR UPDATE OF user_id ON public.motoristas
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_profile_user_id();