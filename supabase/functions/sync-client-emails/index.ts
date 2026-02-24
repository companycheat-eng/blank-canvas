import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin_geral OR allow internal calls (no auth = use service key check via secret header)
    const authHeader = req.headers.get("Authorization") || "";
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternal = internalSecret === serviceRoleKey;

    if (!isInternal) {
      if (!authHeader) throw new Error("Não autenticado");
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (!caller) throw new Error("Não autenticado");

      const { data: roles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin_geral");
      if (!roles || roles.length === 0) throw new Error("Sem permissão");
    }

    // Get all clientes without email
    const { data: clientes } = await adminClient
      .from("clientes")
      .select("id, user_id")
      .or("email.is.null,email.eq.");

    if (!clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "Nenhum cliente sem email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let synced = 0;
    for (const cliente of clientes) {
      const { data: { user } } = await adminClient.auth.admin.getUserById(cliente.user_id);
      if (user?.email) {
        await adminClient.from("clientes").update({ email: user.email }).eq("id", cliente.id);
        synced++;
      }
    }

    return new Response(JSON.stringify({ ok: true, synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, erro: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
