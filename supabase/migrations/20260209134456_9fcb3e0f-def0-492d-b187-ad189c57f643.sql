
-- ============================================================
-- CARRETO APP - MODELO DE DADOS COMPLETO
-- ============================================================

-- 1) ENUM TYPES
CREATE TYPE public.app_role AS ENUM ('admin_geral', 'admin_bairro');
CREATE TYPE public.kyc_status AS ENUM ('pendente_analise', 'aprovado', 'reprovado', 'bloqueado');
CREATE TYPE public.corrida_status AS ENUM ('buscando', 'aceita', 'a_caminho', 'chegou', 'carregando', 'em_deslocamento', 'finalizada', 'cancelada');
CREATE TYPE public.online_status AS ENUM ('online', 'offline');
CREATE TYPE public.ledger_tipo AS ENUM ('credito', 'debito');
CREATE TYPE public.autor_tipo AS ENUM ('cliente', 'motorista', 'sistema');
CREATE TYPE public.user_tipo AS ENUM ('cliente', 'motorista');
CREATE TYPE public.recarga_status AS ENUM ('pendente', 'aprovada', 'cancelada');

-- 2) BAIRROS
CREATE TABLE public.bairros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cidade TEXT NOT NULL DEFAULT 'São Paulo',
  estado TEXT NOT NULL DEFAULT 'SP',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bairros visíveis por todos autenticados" ON public.bairros FOR SELECT TO authenticated USING (true);

-- 3) USER ROLES (security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE SET NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_bairro(_user_id UUID, _role app_role, _bairro_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND bairro_id = _bairro_id
  )
$$;

CREATE POLICY "Admins podem ver roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR user_id = auth.uid());
CREATE POLICY "Admin geral gerencia roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 4) CLIENTES
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cpf TEXT NOT NULL UNIQUE,
  telefone TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  bairro_id UUID REFERENCES public.bairros(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cliente vê próprio perfil" ON public.clientes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Cliente cria próprio perfil" ON public.clientes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Cliente atualiza próprio perfil" ON public.clientes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins veem todos clientes" ON public.clientes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id));

-- 5) MOTORISTAS
CREATE TABLE public.motoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cpf TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL UNIQUE,
  bairro_id UUID REFERENCES public.bairros(id) NOT NULL,
  selfie_url TEXT,
  cnh_url TEXT,
  status_kyc kyc_status NOT NULL DEFAULT 'pendente_analise',
  kyc_motivo TEXT,
  saldo_creditos NUMERIC(12,2) NOT NULL DEFAULT 0,
  status_online online_status NOT NULL DEFAULT 'offline',
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista vê próprio perfil" ON public.motoristas FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Motorista cria próprio perfil" ON public.motoristas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Motorista atualiza próprio perfil" ON public.motoristas FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins veem motoristas" ON public.motoristas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id));
CREATE POLICY "Admins atualizam motoristas" ON public.motoristas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id));

-- 6) CATÁLOGO DE ITENS
CREATE TABLE public.itens_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  icone TEXT DEFAULT 'package',
  preco_base NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.itens_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens visíveis por todos autenticados" ON public.itens_global FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin geral gerencia itens" ON public.itens_global FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

CREATE TABLE public.itens_bairro_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.itens_global(id) ON DELETE CASCADE NOT NULL,
  preco_override NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(bairro_id, item_id)
);
ALTER TABLE public.itens_bairro_override ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Override visível por autenticados" ON public.itens_bairro_override FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin bairro gerencia override" ON public.itens_bairro_override FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id));

-- 7) CONFIGURAÇÕES
CREATE TABLE public.config_global (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  descricao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.config_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config global visível autenticados" ON public.config_global FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin geral gerencia config" ON public.config_global FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

CREATE TABLE public.config_bairro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro_id UUID REFERENCES public.bairros(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(bairro_id, key)
);
ALTER TABLE public.config_bairro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config bairro visível autenticados" ON public.config_bairro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin bairro gerencia config" ON public.config_bairro FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id));

-- 8) CORRIDAS
CREATE TABLE public.corridas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro_id UUID REFERENCES public.bairros(id) NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  motorista_id UUID REFERENCES public.motoristas(id),
  status corrida_status NOT NULL DEFAULT 'buscando',
  origem_texto TEXT NOT NULL,
  destino_texto TEXT NOT NULL,
  origem_lat DOUBLE PRECISION NOT NULL,
  origem_lng DOUBLE PRECISION NOT NULL,
  destino_lat DOUBLE PRECISION NOT NULL,
  destino_lng DOUBLE PRECISION NOT NULL,
  distancia_km NUMERIC(10,2),
  duracao_min INTEGER,
  preco_itens NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_total_estimado NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_pct_usada NUMERIC(5,2),
  taxa_creditos_debitada NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;

-- Cliente vê suas corridas
CREATE POLICY "Cliente vê suas corridas" ON public.corridas FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));
-- Motorista vê corridas do bairro em busca ou suas aceitas
CREATE POLICY "Motorista vê corridas relevantes" ON public.corridas FOR SELECT TO authenticated
  USING (
    motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR (
      status = 'buscando'
      AND bairro_id IN (SELECT bairro_id FROM public.motoristas WHERE user_id = auth.uid() AND status_kyc = 'aprovado' AND status_online = 'online')
    )
  );
-- Cliente cria corridas
CREATE POLICY "Cliente cria corridas" ON public.corridas FOR INSERT TO authenticated
  WITH CHECK (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));
-- Admins veem corridas
CREATE POLICY "Admins veem corridas" ON public.corridas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral') OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id));
-- Update permitido para motorista (aceitar) e admin
CREATE POLICY "Motorista atualiza corrida aceita" ON public.corridas FOR UPDATE TO authenticated
  USING (
    motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin_geral')
    OR public.has_role_in_bairro(auth.uid(), 'admin_bairro', bairro_id)
  );

-- Enable realtime for corridas
ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas;

-- 9) CORRIDA ITENS
CREATE TABLE public.corrida_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id UUID REFERENCES public.corridas(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.itens_global(id) NOT NULL,
  qtd INTEGER NOT NULL DEFAULT 1,
  preco_unit NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.corrida_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Corrida itens seguem corrida" ON public.corrida_itens FOR SELECT TO authenticated
  USING (corrida_id IN (SELECT id FROM public.corridas));
CREATE POLICY "Cliente insere itens" ON public.corrida_itens FOR INSERT TO authenticated
  WITH CHECK (corrida_id IN (SELECT id FROM public.corridas WHERE cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())));

-- 10) WALLET LEDGER
CREATE TABLE public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id UUID REFERENCES public.motoristas(id) ON DELETE CASCADE NOT NULL,
  tipo ledger_tipo NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  motivo TEXT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista vê próprio ledger" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid()));
CREATE POLICY "Admins veem ledger" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_geral'));

-- 11) RECARGAS
CREATE TABLE public.recargas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id UUID REFERENCES public.motoristas(id) ON DELETE CASCADE NOT NULL,
  valor_brl NUMERIC(10,2) NOT NULL,
  creditos NUMERIC(10,2) NOT NULL,
  status recarga_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recargas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista vê próprias recargas" ON public.recargas FOR SELECT TO authenticated
  USING (motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid()));
CREATE POLICY "Motorista cria recarga" ON public.recargas FOR INSERT TO authenticated
  WITH CHECK (motorista_id IN (SELECT id FROM public.motoristas WHERE user_id = auth.uid()));

-- 12) CHAT MENSAGENS
CREATE TABLE public.chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id UUID REFERENCES public.corridas(id) ON DELETE CASCADE NOT NULL,
  autor_tipo autor_tipo NOT NULL,
  autor_id UUID NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participantes veem chat" ON public.chat_mensagens FOR SELECT TO authenticated
  USING (corrida_id IN (SELECT id FROM public.corridas));
CREATE POLICY "Participantes enviam mensagem" ON public.chat_mensagens FOR INSERT TO authenticated
  WITH CHECK (corrida_id IN (SELECT id FROM public.corridas));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;

-- 13) PUSH TOKENS
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_tipo user_tipo NOT NULL,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário gerencia próprios tokens" ON public.push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- 14) UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bairros_updated_at BEFORE UPDATE ON public.bairros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_motoristas_updated_at BEFORE UPDATE ON public.motoristas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_corridas_updated_at BEFORE UPDATE ON public.corridas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_config_global_updated_at BEFORE UPDATE ON public.config_global FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15) STORAGE BUCKET para KYC
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

CREATE POLICY "Motorista faz upload próprio KYC" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Motorista vê próprio KYC" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins veem KYC" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (public.has_role(auth.uid(), 'admin_geral') OR public.has_role(auth.uid(), 'admin_bairro')));

-- 16) ACCEPT RIDE FUNCTION (atomic)
CREATE OR REPLACE FUNCTION public.aceitar_corrida(
  p_corrida_id UUID,
  p_motorista_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF v_corrida.status != 'buscando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Corrida já aceita ou finalizada'); END IF;

  -- Check motorista
  SELECT * INTO v_motorista FROM motoristas WHERE id = p_motorista_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista não encontrado'); END IF;
  IF v_motorista.status_kyc != 'aprovado' THEN RETURN jsonb_build_object('ok', false, 'erro', 'KYC não aprovado'); END IF;
  IF v_motorista.status_online != 'online' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Motorista offline'); END IF;
  IF v_motorista.bairro_id != v_corrida.bairro_id THEN RETURN jsonb_build_object('ok', false, 'erro', 'Bairro diferente'); END IF;

  -- Get taxa config (bairro override or global)
  SELECT value INTO v_config_value FROM config_bairro WHERE bairro_id = v_corrida.bairro_id AND key = 'taxa_percentual';
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value FROM config_global WHERE key = 'taxa_percentual';
  END IF;
  v_taxa_pct := COALESCE((v_config_value->>'valor')::NUMERIC, 10);

  -- Calculate credits to debit
  v_taxa_creditos := ROUND(v_corrida.preco_total_estimado * v_taxa_pct / 100, 2);

  -- Check balance
  IF v_motorista.saldo_creditos < v_taxa_creditos THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo insuficiente. Recarregue créditos.', 'necessario', v_taxa_creditos, 'saldo', v_motorista.saldo_creditos);
  END IF;

  -- Debit credits
  UPDATE motoristas SET saldo_creditos = saldo_creditos - v_taxa_creditos WHERE id = p_motorista_id;
  INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo, ref_id) VALUES (p_motorista_id, 'debito', v_taxa_creditos, 'Taxa corrida aceita', p_corrida_id);

  -- Accept ride
  UPDATE corridas SET motorista_id = p_motorista_id, status = 'aceita', taxa_pct_usada = v_taxa_pct, taxa_creditos_debitada = v_taxa_creditos WHERE id = p_corrida_id;

  RETURN jsonb_build_object('ok', true, 'taxa_creditos', v_taxa_creditos);
END;
$$;

-- 17) DEFAULT CONFIG
INSERT INTO public.config_global (key, value, descricao) VALUES
  ('taxa_percentual', '{"valor": 10}'::jsonb, 'Percentual cobrado do motorista ao aceitar corrida'),
  ('valor_por_km', '{"valor": 3.50}'::jsonb, 'Valor por km da rota'),
  ('taxa_base', '{"valor": 5.00}'::jsonb, 'Taxa base por corrida'),
  ('timeout_busca_segundos', '{"valor": 120}'::jsonb, 'Timeout para buscar motorista'),
  ('creditos_por_real', '{"valor": 1}'::jsonb, 'Créditos por R$1 em recarga');

-- 18) DEFAULT ITENS
INSERT INTO public.itens_global (nome, icone, preco_base) VALUES
  ('Geladeira', 'refrigerator', 50.00),
  ('Sofá', 'sofa', 40.00),
  ('Cama', 'bed-double', 45.00),
  ('Mesa', 'table', 30.00),
  ('Cadeira', 'armchair', 15.00),
  ('Caixa pequena', 'package', 5.00),
  ('Caixa média', 'package', 8.00),
  ('Caixa grande', 'package', 12.00),
  ('Máquina de lavar', 'washing-machine', 55.00),
  ('TV', 'monitor', 25.00),
  ('Guarda-roupa', 'door-closed', 60.00),
  ('Estante', 'library', 35.00);

-- Enable realtime for motoristas (location updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas;
