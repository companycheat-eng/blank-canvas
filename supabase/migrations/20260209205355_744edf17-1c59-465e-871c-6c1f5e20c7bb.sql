
-- Support tickets table
CREATE TABLE public.suporte_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_tipo public.user_tipo NOT NULL,
  assunto text NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support messages table
CREATE TABLE public.suporte_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  autor_tipo text NOT NULL DEFAULT 'usuario',
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suporte_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;

-- RLS for suporte_tickets
CREATE POLICY "Usuário vê próprios tickets"
  ON public.suporte_tickets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuário cria ticket"
  ON public.suporte_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário atualiza próprio ticket"
  ON public.suporte_tickets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Suporte vê todos tickets"
  ON public.suporte_tickets FOR SELECT
  USING (has_role(auth.uid(), 'suporte'::app_role) OR has_role(auth.uid(), 'admin_geral'::app_role));

CREATE POLICY "Suporte atualiza tickets"
  ON public.suporte_tickets FOR UPDATE
  USING (has_role(auth.uid(), 'suporte'::app_role) OR has_role(auth.uid(), 'admin_geral'::app_role));

-- RLS for suporte_mensagens
CREATE POLICY "Participantes veem mensagens do ticket"
  ON public.suporte_mensagens FOR SELECT
  USING (ticket_id IN (SELECT id FROM suporte_tickets));

CREATE POLICY "Participantes enviam mensagens"
  ON public.suporte_mensagens FOR INSERT
  WITH CHECK (ticket_id IN (SELECT id FROM suporte_tickets));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.suporte_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suporte_tickets;

-- Trigger updated_at
CREATE TRIGGER update_suporte_tickets_updated_at
  BEFORE UPDATE ON public.suporte_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
