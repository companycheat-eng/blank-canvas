import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Get request body
    const { valor, recarga_id } = await req.json();
    if (!valor || valor < 1 || !recarga_id) {
      return new Response(JSON.stringify({ error: "Valor e recarga_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get motorista + bairro
    const { data: motorista } = await supabase
      .from("motoristas")
      .select("id, bairro_id, nome")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!motorista) {
      return new Response(JSON.stringify({ error: "Motorista não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get MP config from bairro, with fallback to global
    const { data: bairroConfigs } = await supabase
      .from("config_bairro")
      .select("key, value")
      .eq("bairro_id", motorista.bairro_id)
      .in("key", ["mp_access_token", "mp_api_base_url"]);

    const configMap: Record<string, string> = {};
    (bairroConfigs || []).forEach((c: any) => {
      configMap[c.key] = c.value?.valor || c.value;
    });

    // Fallback to global config if bairro doesn't have MP configured
    if (!configMap["mp_access_token"]) {
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: globalConfigs } = await serviceClient
        .from("config_global")
        .select("key, value")
        .in("key", ["mp_access_token", "mp_api_base_url"]);

      (globalConfigs || []).forEach((c: any) => {
        if (!configMap[c.key]) {
          configMap[c.key] = typeof c.value === "string" ? c.value : (c.value?.valor || c.value);
        }
      });
    }

    const accessToken = configMap["mp_access_token"];
    const apiBaseUrl = configMap["mp_api_base_url"] || "https://api.mercadopago.com";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "MercadoPago não configurado. Configure o gateway global ou no bairro." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create PIX payment via MercadoPago API
    const paymentBody = {
      transaction_amount: Number(valor),
      description: `Recarga Carreto - ${motorista.nome}`,
      payment_method_id: "pix",
      payer: {
        email: claimsData.claims.email || "motorista@carreto.app",
      },
    };

    const mpRes = await fetch(`${apiBaseUrl}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": recarga_id,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP Error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Erro ao criar pagamento PIX", details: mpData.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null;
    const copiaCola = mpData.point_of_interaction?.transaction_data?.qr_code || null;
    const paymentId = String(mpData.id);

    // Update recarga with MP data using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await serviceClient
      .from("recargas")
      .update({
        mp_payment_id: paymentId,
        pix_qr_code: qrCode,
        pix_copia_cola: copiaCola,
      })
      .eq("id", recarga_id);

    return new Response(
      JSON.stringify({
        payment_id: paymentId,
        qr_code_base64: qrCode,
        copia_cola: copiaCola,
        status: mpData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
