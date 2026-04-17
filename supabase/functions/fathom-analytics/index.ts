import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FATHOM_API = "https://api.usefathom.com/v1";
const FATHOM_KEY = Deno.env.get("FATHOM_API_KEY") ?? "";

async function fathomGet(path: string) {
  console.log(`Fathom request: ${FATHOM_API}${path}`);
  console.log(`API key present: ${!!FATHOM_KEY}, length: ${FATHOM_KEY.length}`);

  const res = await fetch(`${FATHOM_API}${path}`, {
    headers: { Authorization: `Bearer ${FATHOM_KEY}` },
  });

  const text = await res.text();
  console.log(`Fathom response status: ${res.status}, body preview: ${text.substring(0, 200)}`);

  if (!res.ok) {
    throw new Error(`Fathom API error [${res.status}]: ${text.substring(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Fathom returned non-JSON response: ${text.substring(0, 200)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!FATHOM_KEY) throw new Error("FATHOM_API_KEY is not configured");

    const body = await req.json();
    const { action, siteId, dateFrom, dateTo } = body;

    if (action === "list_sites") {
      const data = await fathomGet("/sites?limit=50");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_aggregation") {
      if (!siteId) throw new Error("siteId is required");
      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] + " 00:00:00";
      const to = dateTo || new Date().toISOString().split("T")[0] + " 23:59:59";

      const params = new URLSearchParams({
        entity: "pageview",
        entity_id: siteId,
        aggregates: "visits,uniques,pageviews,avg_duration,bounce_rate",
        date_from: from,
        date_to: to,
      });

      const data = await fathomGet(`/aggregations?${params}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_current_visitors") {
      if (!siteId) throw new Error("siteId is required");
      const data = await fathomGet(`/current_visitors?site_id=${siteId}&detailed=true`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Fathom edge function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
