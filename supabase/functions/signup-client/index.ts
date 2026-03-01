import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { telefone, senha, nome, cpf, email, bairro_id } = await req.json();

    if (!telefone || !senha || !nome || !cpf || !email || !bairro_id) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digits = telefone.replace(/\D/g, "");
    if (digits.length !== 11 || digits[2] !== "9") {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (senha.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if phone already exists
    const { data: existingCliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("telefone", digits)
      .maybeSingle();

    if (existingCliente) {
      return new Response(JSON.stringify({ error: "Este telefone já está cadastrado" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user with REAL email (bypasses email validation via admin API)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailTrimmed,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      const msg = authError.message;
      return new Response(JSON.stringify({ 
        error: msg.includes("already been registered") ? "Este email já está cadastrado" : msg 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Insert cliente profile
    const { error: insertError } = await supabase.from("clientes").insert({
      user_id: userId,
      cpf: cpf.replace(/\D/g, ""),
      telefone: digits,
      email: emailTrimmed,
      nome,
      bairro_id,
    });

    if (insertError) {
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao salvar perfil: " + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign in to get tokens
    const signInRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ email: emailTrimmed, password: senha }),
    });

    const signInData = await signInRes.json();

    if (!signInRes.ok || !signInData.access_token) {
      return new Response(JSON.stringify({ 
        ok: true, 
        user_id: userId,
        error_session: "Conta criada, mas faça login manualmente" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      user_id: userId,
      access_token: signInData.access_token,
      refresh_token: signInData.refresh_token,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error in signup-client:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
