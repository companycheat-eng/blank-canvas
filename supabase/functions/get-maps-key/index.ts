import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bairroId = url.searchParams.get("bairro_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Check bairro-specific key
    if (bairroId) {
      const { data: bairroConfig } = await supabase
        .from("config_bairro")
        .select("value")
        .eq("bairro_id", bairroId)
        .eq("key", "google_maps_api_key")
        .maybeSingle();

      if (bairroConfig?.value) {
        const key = typeof bairroConfig.value === "string" ? bairroConfig.value : (bairroConfig.value as any)?.valor;
        if (key) {
          return new Response(
            JSON.stringify({ key }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 2. Check global config key
    const { data: globalConfig } = await supabase
      .from("config_global")
      .select("value")
      .eq("key", "google_maps_api_key")
      .maybeSingle();

    if (globalConfig?.value) {
      const key = typeof globalConfig.value === "string" ? globalConfig.value : (globalConfig.value as any)?.valor;
      if (key) {
        return new Response(
          JSON.stringify({ key }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Fallback to env secret
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ key: apiKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
