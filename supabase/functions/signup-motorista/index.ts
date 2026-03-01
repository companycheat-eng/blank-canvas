import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { email, senha, nome, cpf, telefone, bairro_id, placa, selfie_path, cnh_path, doc_veiculo_path, profile_path } = body;

    if (!email || !senha || !nome || !cpf || !telefone || !bairro_id || !placa) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check duplicates
    const { data: existingCpf } = await supabase.from("motoristas").select("id").eq("cpf", cpf).maybeSingle();
    if (existingCpf) {
      return new Response(JSON.stringify({ error: "Este CPF já está cadastrado" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingTel } = await supabase.from("motoristas").select("id").eq("telefone", telefone).maybeSingle();
    if (existingTel) {
      return new Response(JSON.stringify({ error: "Este telefone já está cadastrado" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user via admin API (bypasses rate limits)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      const msg = authError.message;
      return new Response(JSON.stringify({
        error: msg.includes("already been registered") ? "Este email já está cadastrado" : msg,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Insert motorista profile
    const { error: insertError } = await supabase.from("motoristas").insert({
      user_id: userId,
      cpf,
      nome,
      telefone,
      bairro_id,
      placa: placa.toUpperCase().trim(),
      selfie_url: selfie_path || null,
      cnh_url: cnh_path || null,
      doc_veiculo_url: doc_veiculo_path || null,
      foto_url: profile_path || null,
    });

    if (insertError) {
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao salvar perfil: " + insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error in signup-motorista:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
