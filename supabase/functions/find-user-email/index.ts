import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, user_type } = await req.json();
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const digits = phone.replace(/\D/g, "");

    if (user_type === "motorista") {
      // Motoristas may be registered with real email, not phone@carreto.app
      // Search by phone in motoristas table, then get auth email
      const { data: motorista } = await supabase
        .from("motoristas")
        .select("user_id, telefone")
        .eq("telefone", digits)
        .limit(1)
        .maybeSingle();

      if (!motorista) {
        // Try with phone@carreto.app format as fallback
        return new Response(JSON.stringify({ email: `${digits}@carreto.app` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get auth email for this user
      const { data: authUser } = await supabase.auth.admin.getUserById(motorista.user_id);
      if (authUser?.user?.email) {
        return new Response(JSON.stringify({ email: authUser.user.email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ email: `${digits}@carreto.app` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For clients, look up email from clientes table, then auth
    const { data: cliente } = await supabase
      .from("clientes")
      .select("user_id, email")
      .eq("telefone", digits)
      .limit(1)
      .maybeSingle();

    if (cliente) {
      // If email stored in clientes table, use it
      if (cliente.email) {
        return new Response(JSON.stringify({ email: cliente.email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Otherwise get from auth
      const { data: authUser } = await supabase.auth.admin.getUserById(cliente.user_id);
      if (authUser?.user?.email) {
        return new Response(JSON.stringify({ email: authUser.user.email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback
    return new Response(JSON.stringify({ email: `${digits}@carreto.app` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in find-user-email:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
