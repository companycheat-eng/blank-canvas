import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createHmac } from "node:crypto";

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
    const body = await req.text();
    const payload = JSON.parse(body);

    // We expect action = payment.updated or payment.created
    if (payload.type !== "payment") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = String(payload.data?.id);
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "No payment id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find recarga by mp_payment_id
    const { data: recarga } = await supabase
      .from("recargas")
      .select("id, motorista_id, creditos, status, motoristas(bairro_id)")
      .eq("mp_payment_id", paymentId)
      .limit(1)
      .single();

    if (!recarga) {
      console.log("Recarga not found for payment:", paymentId);
      return new Response(JSON.stringify({ ok: true, msg: "recarga not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already processed
    if (recarga.status === "aprovada") {
      return new Response(JSON.stringify({ ok: true, msg: "already approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify with MP - get bairro config for access token
    const bairroId = (recarga as any).motoristas?.bairro_id;
    if (!bairroId) {
      return new Response(JSON.stringify({ error: "Bairro not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get MP config from bairro, with fallback to global
    const { data: bairroConfigs } = await supabase
      .from("config_bairro")
      .select("key, value")
      .eq("bairro_id", bairroId)
      .in("key", ["mp_access_token", "mp_api_base_url", "mp_webhook_secret"]);

    const configMap: Record<string, string> = {};
    (bairroConfigs || []).forEach((c: any) => {
      configMap[c.key] = c.value?.valor || c.value;
    });

    // Fallback to global config if bairro doesn't have MP configured
    if (!configMap["mp_access_token"]) {
      const { data: globalConfigs } = await supabase
        .from("config_global")
        .select("key, value")
        .in("key", ["mp_access_token", "mp_api_base_url", "mp_webhook_secret"]);

      (globalConfigs || []).forEach((c: any) => {
        if (!configMap[c.key]) {
          configMap[c.key] = typeof c.value === "string" ? c.value : (c.value?.valor || c.value);
        }
      });
    }

    const accessToken = configMap["mp_access_token"];
    const apiBaseUrl = configMap["mp_api_base_url"] || "https://api.mercadopago.com";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "MP not configured (neither bairro nor global)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally verify webhook signature
    const webhookSecret = configMap["mp_webhook_secret"];
    if (webhookSecret) {
      const xSignature = req.headers.get("x-signature");
      const xRequestId = req.headers.get("x-request-id");
      if (xSignature && xRequestId) {
        // MercadoPago signature format: ts=...,v1=...
        const parts: Record<string, string> = {};
        xSignature.split(",").forEach((p) => {
          const [k, v] = p.split("=");
          parts[k.trim()] = v.trim();
        });
        const ts = parts["ts"];
        const v1 = parts["v1"];
        if (ts && v1) {
          const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
          const hmac = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
          if (hmac !== v1) {
            console.error("Invalid webhook signature");
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    // Verify payment status with MercadoPago
    const mpRes = await fetch(`${apiBaseUrl}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mpData = await mpRes.json();

    if (mpData.status === "approved") {
      // Approve recarga and credit motorista
      await supabase.from("recargas").update({ status: "aprovada" }).eq("id", recarga.id);

      // Add credits
      await supabase
        .from("motoristas")
        .update({
          saldo_creditos: supabase.rpc ? undefined : undefined, // handled below
        })
        .eq("id", recarga.motorista_id);

      // Use raw SQL via RPC is not available, so do it manually
      const { data: mot } = await supabase
        .from("motoristas")
        .select("saldo_creditos")
        .eq("id", recarga.motorista_id)
        .single();

      if (mot) {
        await supabase
          .from("motoristas")
          .update({ saldo_creditos: Number(mot.saldo_creditos) + Number(recarga.creditos) })
          .eq("id", recarga.motorista_id);
      }

      // Add ledger entry
      await supabase.from("wallet_ledger").insert({
        motorista_id: recarga.motorista_id,
        tipo: "credito",
        valor: recarga.creditos,
        motivo: "Recarga via PIX (MercadoPago)",
        ref_id: recarga.id,
      });

      console.log("Recarga approved:", recarga.id);
    } else if (mpData.status === "cancelled" || mpData.status === "rejected") {
      await supabase.from("recargas").update({ status: "cancelada" }).eq("id", recarga.id);
      console.log("Recarga cancelled:", recarga.id);
    }

    return new Response(JSON.stringify({ ok: true, status: mpData.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
