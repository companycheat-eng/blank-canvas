import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Key, Database, Server, FolderOpen, FileText, Shield, AlertTriangle, Terminal, GitBranch, Globe, HardDrive, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const secrets = [
  { nome: "GOOGLE_MAPS_API_KEY", descricao: "Chave da API do Google Maps (Places, Directions, Maps JS)", onde: "Google Cloud Console → APIs & Services → Credentials" },
  { nome: "SUPABASE_URL", descricao: "URL do projeto Supabase", onde: "Supabase Dashboard → Settings → API" },
  { nome: "SUPABASE_ANON_KEY", descricao: "Chave pública (anon) do Supabase", onde: "Supabase Dashboard → Settings → API" },
  { nome: "SUPABASE_SERVICE_ROLE_KEY", descricao: "Chave de serviço (admin) do Supabase — NUNCA expor no frontend", onde: "Supabase Dashboard → Settings → API" },
  { nome: "SUPABASE_DB_URL", descricao: "URL de conexão direta ao banco PostgreSQL", onde: "Supabase Dashboard → Settings → Database" },
  { nome: "MP_ACCESS_TOKEN", descricao: "Token de acesso do Mercado Pago (para pagamentos PIX)", onde: "Mercado Pago → Suas integrações → Credenciais" },
  { nome: "FIND_USER_EMAIL_SECRET", descricao: "Secret para busca de email (Edge Function find-user-email)", onde: "Definido manualmente" },
];

const envFrontend = [
  { nome: "VITE_SUPABASE_URL", descricao: "URL do Supabase (acessível no frontend via import.meta.env)", exemplo: "https://SEU_PROJECT_ID.supabase.co" },
  { nome: "VITE_SUPABASE_PUBLISHABLE_KEY", descricao: "Chave anon do Supabase (pública, pode ficar no frontend)", exemplo: "eyJhbG..." },
  { nome: "VITE_SUPABASE_PROJECT_ID", descricao: "ID do projeto Supabase", exemplo: "abcdef123456" },
];

const checklist = [
  { item: "Código-fonte sincronizado com GitHub", tipo: "codigo", prioridade: "alta" },
  { item: "Migrations SQL (pasta supabase/migrations/)", tipo: "banco", prioridade: "alta" },
  { item: "Dados exportados das tabelas (pg_dump ou CSVs)", tipo: "dados", prioridade: "alta" },
  { item: "Arquivos de Storage migrados (profile-photos, kyc-documents)", tipo: "storage", prioridade: "média" },
  { item: "Secrets e API keys configuradas no novo Supabase", tipo: "config", prioridade: "alta" },
  { item: "Edge Functions deployadas no novo projeto", tipo: "codigo", prioridade: "alta" },
  { item: "Domínio e DNS configurados", tipo: "infra", prioridade: "média" },
  { item: "Auth redirect URLs atualizadas", tipo: "config", prioridade: "alta" },
  { item: "Teste completo de fluxo (cadastro → corrida → pagamento)", tipo: "teste", prioridade: "alta" },
];

const edgeFunctions = [
  { nome: "admin-add-credit", descricao: "Adicionar créditos a motorista (admin)", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "admin-update-user", descricao: "Atualizar dados de usuário (admin)", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "create-admin-bairro", descricao: "Criar admin de bairro com auth", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "create-pix-payment", descricao: "Criar pagamento PIX (Mercado Pago)", secrets: ["MP_ACCESS_TOKEN"] },
  { nome: "drivers-location", descricao: "Atualizar localização do motorista", secrets: [] },
  { nome: "find-user-email", descricao: "Buscar email de usuário", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "get-maps-key", descricao: "Retornar chave Google Maps para o frontend", secrets: ["GOOGLE_MAPS_API_KEY"] },
  { nome: "manage-suporte", descricao: "Gerenciar tickets de suporte", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "mp-webhook", descricao: "Webhook do Mercado Pago", secrets: ["MP_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "reset-password", descricao: "Redefinir senha do usuário", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "send-password-reset", descricao: "Enviar email de redefinição de senha", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
  { nome: "sync-client-emails", descricao: "Sincronizar emails de clientes", secrets: ["SUPABASE_SERVICE_ROLE_KEY"] },
];

const storageBuckets = [
  { nome: "profile-photos", publico: true, descricao: "Fotos de perfil de clientes e motoristas" },
  { nome: "kyc-documents", publico: false, descricao: "Documentos de verificação (CNH, selfie, doc veículo)" },
];

const tabelasExportar = [
  "bairros", "categorias_itens", "clientes", "config_bairro", "config_global",
  "contra_propostas", "corrida_itens", "corridas", "itens_bairro_override",
  "itens_global", "motoristas", "password_reset_tokens", "push_tokens",
  "recargas", "suporte_mensagens", "suporte_tickets", "user_roles",
  "wallet_ledger", "chat_mensagens",
];

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      <div className="bg-muted rounded-lg p-3 pr-10 overflow-x-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-background/80 text-muted-foreground"
          title="Copiar"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function AdminMigracao() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="text-2xl font-bold">Guia Completo de Migração</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Passo a passo detalhado para migrar o Carreto App do Lovable Cloud para um Supabase dedicado com deploy via GitHub
        </p>
      </div>

      {/* Visão Geral */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">O que será migrado:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li><strong>Frontend</strong> — código React/Vite (repositório GitHub)</li>
                <li><strong>Banco de dados</strong> — schema completo + dados (PostgreSQL)</li>
                <li><strong>Edge Functions</strong> — 12 funções serverless (Deno)</li>
                <li><strong>Storage</strong> — 2 buckets (fotos e documentos KYC)</li>
                <li><strong>Autenticação</strong> — sistema de auth com usuários existentes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Checklist de Migração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                <div className="h-5 w-5 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
                <span className="text-sm flex-1">{c.item}</span>
                <Badge variant={c.prioridade === "alta" ? "destructive" : "outline"} className="text-xs">
                  {c.prioridade}
                </Badge>
                <Badge variant="outline" className="text-xs">{c.tipo}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Passo a Passo Detalhado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Passo a Passo Detalhado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="single" collapsible className="w-full">
            {/* PASSO 1 */}
            <AccordionItem value="step-1" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">1</Badge>
                  Pré-requisitos — Instalar ferramentas
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">Instale as ferramentas necessárias no seu computador:</p>
                <CopyBlock label="Instalar Supabase CLI" code={`# macOS (Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (qualquer OS)
npm install -g supabase`} />
                <CopyBlock label="Instalar Node.js e Git" code={`# Verifique se já estão instalados
node --version   # v18+ recomendado
git --version
npm --version`} />
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 2 */}
            <AccordionItem value="step-2" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">2</Badge>
                  Conectar ao GitHub e clonar o repositório
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  Primeiro, conecte seu projeto Lovable ao GitHub (Settings → GitHub). Depois clone:
                </p>
                <CopyBlock label="Clonar repositório" code={`git clone https://github.com/SEU_USUARIO/carreto-app.git
cd carreto-app
npm install`} />
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    O repositório já contém todas as migrations, edge functions e configurações. Tudo que precisa é ajustar as variáveis de ambiente.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 3 */}
            <AccordionItem value="step-3" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">3</Badge>
                  Criar projeto Supabase dedicado
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">Crie um novo projeto no Supabase:</p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Acesse <strong>supabase.com/dashboard</strong> e crie uma conta (ou faça login)</li>
                  <li>Clique em <strong>"New Project"</strong></li>
                  <li>Escolha organização, nome (ex: "carreto-app"), senha do banco e região (<strong>São Paulo</strong> recomendado)</li>
                  <li>Aguarde a criação (~2 min)</li>
                  <li>Anote as credenciais em <strong>Settings → API</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li><code className="font-mono text-xs">Project URL</code></li>
                      <li><code className="font-mono text-xs">anon/public key</code></li>
                      <li><code className="font-mono text-xs">service_role key</code></li>
                    </ul>
                  </li>
                </ol>
                <CopyBlock label="Vincular o projeto localmente" code={`supabase login
supabase link --project-ref SEU_PROJECT_ID`} />
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 4 */}
            <AccordionItem value="step-4" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">4</Badge>
                  Migrar schema do banco (migrations)
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  As migrations já estão na pasta <code className="font-mono">supabase/migrations/</code>. Basta aplicar:
                </p>
                <CopyBlock label="Aplicar todas as migrations" code={`supabase db push`} />
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    Isso cria todas as tabelas, RLS policies, triggers, functions, enums e índices automaticamente.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 5 */}
            <AccordionItem value="step-5" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">5</Badge>
                  Exportar e importar dados
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  Exporte os dados do banco atual e importe no novo. Você pode fazer isso pelo SQL Editor do Supabase ou via CLI:
                </p>
                <CopyBlock label="Exportar dados do banco atual (pg_dump)" code={`# Conecte no banco ATUAL (Cloud) — obtenha a connection string no Cloud View
pg_dump --data-only --no-owner --no-acl \\
  --exclude-table-data='auth.*' \\
  --exclude-table-data='storage.*' \\
  "postgresql://postgres:[SENHA]@db.[PROJECT_ID_ATUAL].supabase.co:5432/postgres" \\
  > dados_export.sql`} />
                <CopyBlock label="Importar dados no novo banco" code={`# Conecte no banco NOVO
psql "postgresql://postgres:[SENHA_NOVO]@db.[PROJECT_ID_NOVO].supabase.co:5432/postgres" \\
  < dados_export.sql`} />
                <p className="text-xs text-muted-foreground mt-2">Tabelas que serão migradas:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tabelasExportar.map(t => (
                    <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
                  ))}
                </div>
                <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg mt-2">
                  <p className="text-xs text-destructive flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <strong>IMPORTANTE:</strong> Usuários do auth.users NÃO são exportados via pg_dump. Veja o passo 8 para migrar usuários.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 6 */}
            <AccordionItem value="step-6" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">6</Badge>
                  Configurar Secrets das Edge Functions
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  Configure cada secret no novo projeto Supabase:
                </p>
                <CopyBlock label="Definir secrets via CLI" code={`supabase secrets set GOOGLE_MAPS_API_KEY="sua_chave_aqui"
supabase secrets set MP_ACCESS_TOKEN="seu_token_mercadopago"
# SERVICE_ROLE_KEY e URL do Supabase são automaticamente disponíveis nas Edge Functions`} />
                <div className="space-y-2 mt-3">
                  {secrets.map((s) => (
                    <div key={s.nome} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-bold text-primary">{s.nome}</code>
                        <Shield className="h-3 w-3 text-destructive" />
                      </div>
                      <p className="text-xs text-muted-foreground">{s.descricao}</p>
                      <p className="text-xs text-muted-foreground/70">📍 {s.onde}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 7 */}
            <AccordionItem value="step-7" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">7</Badge>
                  Deploy das Edge Functions
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  As edge functions estão em <code className="font-mono">supabase/functions/</code>. Deploy todas de uma vez:
                </p>
                <CopyBlock label="Deploy de todas as functions" code={`supabase functions deploy`} />
                <CopyBlock label="Ou deploy individual" code={`supabase functions deploy get-maps-key
supabase functions deploy create-pix-payment
supabase functions deploy mp-webhook
# ... etc`} />
                <div className="grid gap-2 mt-3">
                  {edgeFunctions.map((f) => (
                    <div key={f.nome} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <code className="text-xs font-mono">{f.nome}</code>
                      <div className="flex items-center gap-1">
                        {f.secrets.map(s => (
                          <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 8 */}
            <AccordionItem value="step-8" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">8</Badge>
                  Migrar usuários (auth.users)
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  Usuários do Supabase Auth precisam de tratamento especial. Opções:
                </p>
                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium">Opção A: Migração completa (recomendado)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exporte a tabela <code className="font-mono">auth.users</code> do banco atual e importe no novo.
                      Os hashes de senha são preservados, então os usuários mantêm suas credenciais.
                    </p>
                    <CopyBlock code={`-- No banco ATUAL, exporte auth.users:
pg_dump --data-only --no-owner --table='auth.users' \\
  "postgresql://postgres:[SENHA]@db.[PROJECT_ATUAL].supabase.co:5432/postgres" \\
  > auth_users_export.sql

-- No banco NOVO, importe:
psql "postgresql://postgres:[SENHA_NOVO]@db.[PROJECT_NOVO].supabase.co:5432/postgres" \\
  < auth_users_export.sql`} />
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium">Opção B: Recadastro</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Se não conseguir exportar auth.users, os usuários precisarão criar novas contas.
                      Nesse caso, você precisa recriar os registros em <code className="font-mono">clientes</code>, <code className="font-mono">motoristas</code> e <code className="font-mono">user_roles</code> com os novos user_ids.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 9 */}
            <AccordionItem value="step-9" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">9</Badge>
                  Migrar Storage (fotos e documentos)
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">Crie os buckets no novo projeto e migre os arquivos:</p>
                <CopyBlock label="Criar buckets via SQL (rodar no SQL Editor do Supabase)" code={`-- Criar buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Políticas de acesso (profile-photos é público para leitura)
CREATE POLICY "Fotos públicas" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Upload próprio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- kyc-documents: apenas admin e próprio usuário
CREATE POLICY "KYC leitura admin" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents');
CREATE POLICY "KYC upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);`} />
                <p className="text-xs text-muted-foreground">
                  Para migrar os arquivos, você pode usar a API do Supabase Storage para download/upload em lote,
                  ou usar ferramentas como <code className="font-mono">supabase-storage-migrate</code>.
                </p>
                <div className="space-y-2 mt-2">
                  {storageBuckets.map((b) => (
                    <div key={b.nome} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <code className="text-xs font-mono font-bold">{b.nome}</code>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.descricao}</p>
                      </div>
                      <Badge variant={b.publico ? "default" : "secondary"} className="text-xs">
                        {b.publico ? "Público" : "Privado"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 10 */}
            <AccordionItem value="step-10" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">10</Badge>
                  Atualizar variáveis de ambiente do frontend
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  Crie/edite o arquivo <code className="font-mono">.env</code> na raiz do projeto:
                </p>
                <CopyBlock label="Arquivo .env" code={`VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...SUA_ANON_KEY
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_ID`} />
                <p className="text-sm text-muted-foreground mt-2">
                  O arquivo <code className="font-mono">src/integrations/supabase/client.ts</code> precisa ser atualizado
                  para usar essas variáveis (já está configurado assim no projeto).
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 11 */}
            <AccordionItem value="step-11" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">11</Badge>
                  Deploy do frontend (servidor dedicado / VPS)
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  Como o app é um SPA React/Vite, o build gera arquivos estáticos. Escolha sua plataforma:
                </p>

                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      VPS / Servidor Dedicado (Nginx)
                    </p>
                    <CopyBlock code={`# No servidor, clone e build
git clone https://github.com/SEU_USUARIO/carreto-app.git
cd carreto-app
npm install
npm run build

# Os arquivos ficam em dist/
# Configure Nginx para servir:

# /etc/nginx/sites-available/carreto
server {
    listen 80;
    server_name seudominio.com.br;
    root /var/www/carreto-app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}`} />
                  </div>

                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Vercel (mais fácil)
                    </p>
                    <CopyBlock code={`# Instale Vercel CLI
npm i -g vercel

# Na raiz do projeto
vercel

# Ou conecte direto pelo GitHub em vercel.com
# Configure as variáveis de ambiente no painel da Vercel`} />
                  </div>

                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Netlify
                    </p>
                    <CopyBlock code={`# Instale Netlify CLI
npm i -g netlify-cli

# Build e deploy
npm run build
netlify deploy --prod --dir=dist

# Ou conecte pelo GitHub em app.netlify.com`} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 12 */}
            <AccordionItem value="step-12" className="border-b px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">12</Badge>
                  Configurar Auth Redirect URLs
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">
                  No dashboard do Supabase, configure as URLs de redirecionamento:
                </p>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Vá em <strong>Authentication → URL Configuration</strong></li>
                  <li>Adicione a URL do seu domínio em <strong>Site URL</strong>: <code className="font-mono">https://seudominio.com.br</code></li>
                  <li>Adicione em <strong>Redirect URLs</strong>: <code className="font-mono">https://seudominio.com.br/**</code></li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            {/* PASSO 13 */}
            <AccordionItem value="step-13" className="px-4">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">13</Badge>
                  Testes finais
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">Teste cada fluxo crítico:</p>
                <div className="space-y-2">
                  {[
                    "Login de cliente existente",
                    "Login de motorista existente",
                    "Cadastro de novo cliente",
                    "Cadastro de novo motorista (upload KYC)",
                    "Solicitar corrida completa (origem → destino → itens → busca)",
                    "Motorista aceitar corrida",
                    "Fluxo completo: coleta → entrega → finalização",
                    "Pagamento PIX (webhook Mercado Pago)",
                    "Chat entre cliente e motorista",
                    "Painel admin (dashboard, gerenciamento)",
                    "Recarga de créditos do motorista",
                    "Sistema de suporte (abrir/responder ticket)",
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <div className="h-4 w-4 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
                      <span className="text-xs">{t}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Resumo rápido de comandos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Resumo Rápido (todos os comandos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CopyBlock code={`# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/carreto-app.git
cd carreto-app

# 2. Instale dependências
npm install

# 3. Login no Supabase e vincule o projeto
supabase login
supabase link --project-ref SEU_PROJECT_ID

# 4. Aplique o schema do banco
supabase db push

# 5. Configure secrets
supabase secrets set GOOGLE_MAPS_API_KEY="..."
supabase secrets set MP_ACCESS_TOKEN="..."

# 6. Deploy das Edge Functions
supabase functions deploy

# 7. Configure .env
echo 'VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co' > .env
echo 'VITE_SUPABASE_PUBLISHABLE_KEY=SUA_ANON_KEY' >> .env
echo 'VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_ID' >> .env

# 8. Build e deploy
npm run build
# Copie dist/ para seu servidor ou use Vercel/Netlify`} />
        </CardContent>
      </Card>
    </div>
  );
}
