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
    const url = new URL(req.url);
    const bairroId = url.searchParams.get("bairro_id");

    if (!bairroId) {
      return new Response(JSON.stringify({ error: "bairro_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Only return lat/lng + heading + vehicle type of online, approved drivers - no PII
    const { data, error } = await supabase
      .from("motoristas")
      .select("id, last_lat, last_lng, last_heading, tipo_veiculo")
      .eq("bairro_id", bairroId)
      .eq("status_online", "online")
      .eq("status_kyc", "aprovado")
      .not("last_lat", "is", null)
      .not("last_lng", "is", null);

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
