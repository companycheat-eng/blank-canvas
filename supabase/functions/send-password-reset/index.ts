import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    if (!phone || phone.length !== 11) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find user by email pattern
    const email = `${phone}@carreto.app`;
    const { data: authData } = await supabase.auth.admin.listUsers();
    const user = authData?.users?.find((u: any) => u.email === email);

    if (!user) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if user has a real email
    const [{ data: cliente }, { data: motorista }] = await Promise.all([
      supabase.from("clientes").select("email, nome").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("motoristas").select("nome").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

    const realEmail = cliente?.email;
    const nome = cliente?.nome || motorista?.nome || "Usuário";

    if (!realEmail) {
      return new Response(JSON.stringify({ error: "Nenhum email cadastrado. Contate o suporte." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

    // Get SMTP config
    const { data: smtpConfig } = await supabase.from("config_global").select("value").eq("key", "smtp_config").maybeSingle();
    const smtp = smtpConfig?.value as any;

    if (!smtp?.email || !smtp?.password || !smtp?.host) {
      return new Response(JSON.stringify({ error: "Configuração SMTP não encontrada. Contate o administrador." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = "https://carreto-app.lovable.app";
    const resetUrl = `${origin}/redefinir-senha?token=${token}`;

    const port = Number(smtp.port) || 587;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port,
      secure: port === 465,
      auth: {
        user: smtp.email,
        pass: smtp.password,
      },
    });

    await transporter.sendMail({
      from: smtp.email,
      to: realEmail,
      subject: "Carreto App - Redefinição de Senha",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Olá, ${nome}!</h2>
          <p>Você solicitou a redefinição da sua senha no Carreto App.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Redefinir Senha
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>
          <p style="color: #666; font-size: 14px;">Se você não solicitou isso, ignore este email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Carreto App</p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Error in send-password-reset:", err);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
