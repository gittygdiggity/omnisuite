import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INSTANTLY_API = "https://api.instantly.ai/api/v2";
const DEFAULT_INSTANTLY_KEY = Deno.env.get("INSTANTLY_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

// Build an Instantly caller bound to a specific API key
// Handles non-2xx responses and non-JSON bodies gracefully instead of throwing
function makeInstantly(apiKey: string) {
  return async function instantly(path: string, options: RequestInit = {}) {
    let res: Response;
    try {
      res = await fetch(`${INSTANTLY_API}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    } catch (e) {
      console.error(`[instantly] fetch error for ${path}:`, e);
      return {};
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[instantly] ${path} returned HTTP ${res.status}: ${text.slice(0, 300)}`);
      // Return structured error so callers can inspect it
      return { _error: true, _status: res.status, _body: text.slice(0, 300) };
    }

    try {
      return await res.json();
    } catch (_e) {
      const text = await res.text().catch(() => "");
      console.error(`[instantly] ${path} non-JSON response: ${text.slice(0, 200)}`);
      return {};
    }
  };
}

// Fetch all emails for a specific lead (for thread view)
async function fetchEmailsForLead(
  instantly: ReturnType<typeof makeInstantly>,
  leadEmail: string
): Promise<Array<Record<string, unknown>>> {
  const emails: Array<Record<string, unknown>> = [];
  let startingAfter: string | undefined;

  while (true) {
    const params = new URLSearchParams({ lead: leadEmail, limit: "50" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const data = await instantly(`/emails?${params.toString()}`);
    if (data?._error) break;
    const items: Array<Record<string, unknown>> = data?.items ?? [];
    emails.push(...items);
    if (items.length < 50 || !data?.next_starting_after) break;
    startingAfter = data.next_starting_after as string;
  }

  return emails;
}

// Build email thread from raw emails
function buildEmailThread(
  leadId: string,
  leadEmail: string,
  rawEmails: Array<Record<string, unknown>>
): Record<string, unknown> | null {
  if (rawEmails.length === 0) return null;

  const sorted = [...rawEmails].sort((a, b) => {
    const ta = new Date((a.timestamp_email ?? a.timestamp_created ?? 0) as string).getTime();
    const tb = new Date((b.timestamp_email ?? b.timestamp_created ?? 0) as string).getTime();
    return ta - tb;
  });

  const messages = sorted.map((e) => {
    const fromAddr = ((e.from_address_email as string) ?? "").toLowerCase();
    const leadAddr = leadEmail.toLowerCase();
    const isFromLead = fromAddr === leadAddr || fromAddr.includes(leadAddr);

    let body = "";
    if (e.body && typeof e.body === "object") {
      const b = e.body as Record<string, unknown>;
      body = (b.html ?? b.text ?? "") as string;
    } else if (typeof e.body === "string") {
      body = e.body;
    }

    return {
      id: e.id as string,
      sender: isFromLead ? "them" : "us",
      from: fromAddr,
      to: (e.to_address_email_list as string ?? ""),
      subject: (e.subject as string ?? ""),
      body,
      sent_at: (e.timestamp_email ?? e.timestamp_created ?? "") as string,
    };
  });

  const last = sorted[sorted.length - 1];
  return {
    lead_id: leadId,
    instantly_thread_id: (sorted[0].thread_id ?? sorted[0].id) as string ?? null,
    subject: (sorted[0].subject as string) ?? "",
    messages,
    last_message_at: (last.timestamp_email ?? last.timestamp_created ?? null) as string,
  };
}

// Map raw Instantly lead → DB row. sentiment overrides internal field.
function leadToRow(
  l: Record<string, unknown>,
  campaignName: string,
  workspaceName: string,
  clientId: string | null,
  emailMeta?: { name?: string; sentiment?: string }
) {
  const p = (l.payload as Record<string, unknown> | undefined) ?? {};
  const name =
    [l.first_name, l.last_name].filter(Boolean).join(" ") ||
    emailMeta?.name ||
    (l.email as string);
  const email = (l.email as string)?.toLowerCase().trim();
  const sentiment = emailMeta?.sentiment ?? "interested";

  // Capture when the lead was added/subscribed in Instantly
  const instantlyDate = (
    l.timestamp_subscribed ?? l.timestamp_created ?? l.created_at ?? null
  ) as string | null;

  return {
    instantly_id: (l.id as string) || null,
    email,
    name,
    company: (p.company as string) || (l.company_name as string) || (p.website as string) || "",
    title: (p.title as string) || (l.title as string) || null,
    phone: (p.phone as string) || null,
    linkedin_url: (p.linkedIn as string) || (p.linkedin as string) || null,
    source: "instantly" as const,
    campaign_name: campaignName,
    sub_account: workspaceName,
    client_id: clientId,
    sentiment,
    last_contacted: instantlyDate,
    tags: ["instantly", campaignName].filter(Boolean),
  };
}

// Phone lookup via OpenAI web search
async function researchPhoneNumber(
  name: string, company: string, title: string, email: string
): Promise<{ phone: string | null; error?: string }> {
  if (!OPENAI_API_KEY) return { phone: null, error: "OpenAI API key not configured" };
  try {
    const prompt = [
      `Search the internet for the direct phone number of this person:`,
      `Name: ${name}`,
      title  ? `Title: ${title}` : null,
      company ? `Company: ${company}` : null,
      `Email: ${email}`,
      ``,
      `Look at LinkedIn, company websites, contact directories, and any public sources.`,
      `Reply with ONLY the phone number (e.g. +1 555 123 4567) — nothing else.`,
      `If you cannot find a phone number, reply with exactly: NOT_FOUND`,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        tools: [{ type: "web_search_preview" }],
        input: prompt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[enrich_phone] OpenAI error:", res.status, errText.slice(0, 300));
      return { phone: null, error: `OpenAI error ${res.status}` };
    }

    const data = await res.json();
    console.log("[enrich_phone] raw response:", JSON.stringify(data).slice(0, 500));

    const text: string =
      data?.output
        ?.filter((b: Record<string, unknown>) => b.type === "message")
        ?.flatMap((b: Record<string, unknown>) => b.content as Array<Record<string, unknown>>)
        ?.filter((c: Record<string, unknown>) => c.type === "output_text")
        ?.map((c: Record<string, unknown>) => c.text as string)
        ?.join("") ?? "";

    const cleaned = text.trim();
    console.log("[enrich_phone] extracted text:", cleaned);

    if (!cleaned || cleaned === "NOT_FOUND" || cleaned.toLowerCase().includes("not found")) {
      return { phone: null, error: "No phone number found online" };
    }

    // Extract any phone-like pattern from the response
    const match = cleaned.match(/[\+\d][\d\s\-\.\(\)]{6,18}[\d]/);
    if (match) return { phone: match[0].trim() };

    return { phone: null, error: "Could not parse phone from response" };
  } catch (e) {
    console.error("[enrich_phone] exception:", e);
    return { phone: null, error: String(e) };
  }
}

// ─── Core sync ───────────────────────────────────────────────────────────────
// Direct filter approach: pull only positive-reply leads from Instantly using
// campaign_lead_status_description filter on /leads/list. No email scanning,
// no AI classification. Instantly already categorises replies — we trust that.
//
// Positive statuses pulled:
//   "Interested"     → sentiment: interested
//   "Meeting Booked" → sentiment: opportunity
//   "Replied"        → sentiment: interested  (catch-all reply status)
async function runSync(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  clientId: string | null,
  sinceDate?: string // ISO date string — only import leads added/updated after this date
) {
  const instantly = makeInstantly(apiKey);

  // ── Validate API key ──────────────────────────────────────────────────────
  const testData = await instantly("/campaigns?limit=1");
  if (testData?._error) {
    const status = testData._status as number;
    const body = testData._body as string;
    if (status === 401 || status === 403) {
      throw new Error(`Invalid or expired Instantly API key (HTTP ${status}). Check the API key for this account.`);
    }
    throw new Error(`Instantly API returned HTTP ${status}: ${body}`);
  }

  // ── Fetch all campaigns ───────────────────────────────────────────────────
  const campaignMap = new Map<string, { name: string; workspace: string }>();
  {
    let cursor: string | undefined;
    while (true) {
      const url = cursor ? `/campaigns?limit=100&starting_after=${cursor}` : "/campaigns?limit=100";
      const d = await instantly(url);
      if (d?._error) break;
      const items: Array<Record<string, unknown>> = d?.items ?? [];
      for (const c of items) {
        campaignMap.set(c.id as string, {
          name: c.name as string,
          workspace: ((c.workspace_name ?? c.workspace ?? "Default") as string),
        });
      }
      if (items.length < 100 || !d?.next_starting_after) break;
      cursor = d.next_starting_after as string;
    }
  }
  console.log(`[sync] campaigns=${campaignMap.size} client=${clientId ?? "default"}`);

  // ── Fetch all leads per campaign, filter client-side by lt_interest_status ──
  // lt_interest_status is a READ-ONLY response field — it cannot be used as a
  // request filter. We must fetch all leads and filter after.
  //
  // Instantly v2 lt_interest_status values:
  //   null / 0 = no status (never categorised) — SKIP
  //   1 = Interested                            — INCLUDE
  //   2 = Meeting Booked                        — INCLUDE
  //   3 = Meeting Completed                     — INCLUDE
  //   4 = Closed                                — INCLUDE
  //  -1 = Not Interested                        — SKIP
  //  -2 = Wrong Person                          — SKIP
  //  -3 = Lost                                  — SKIP

  // ── Fetch positive leads globally using Instantly's built-in filter strings ─
  // No campaign loop — fetch directly from the CRM-level view.
  // One request per positive status; Instantly filters server-side.
  const POSITIVE_FILTERS: Array<{ filter: string; sentiment: string }> = [
    { filter: "FILTER_LEAD_INTERESTED",         sentiment: "interested" },
    { filter: "FILTER_LEAD_MEETING_BOOKED",     sentiment: "opportunity" },
    { filter: "FILTER_LEAD_MEETING_COMPLETED",  sentiment: "opportunity" },
    { filter: "FILTER_LEAD_CLOSED",             sentiment: "opportunity" },
  ];

  const allRows: ReturnType<typeof leadToRow>[] = [];
  const seen = new Set<string>();
  const workspaces = new Set<string>();

  for (const { filter, sentiment } of POSITIVE_FILTERS) {
    let cursor: string | undefined;

    for (let page = 1; page <= 500; page++) {
      const reqBody: Record<string, unknown> = { filter, limit: 100 };
      if (cursor) reqBody.starting_after = cursor;

      const data = await instantly("/leads/list", { method: "POST", body: JSON.stringify(reqBody) });
      if (data?._error) {
        console.log(`[sync] error filter=${filter}:`, data._status, data._body?.slice(0, 200));
        break;
      }

      const items: Array<Record<string, unknown>> = data?.items ?? [];

      for (const l of items) {
        const email = (l.email as string)?.toLowerCase().trim();
        if (!email || seen.has(email)) continue;

        const cid = l.campaign_id as string | undefined;
        const meta = (cid ? campaignMap.get(cid) : undefined) ?? { name: "Unknown", workspace: "Default" };
        workspaces.add(meta.workspace);

        seen.add(email);
        allRows.push(leadToRow(l, meta.name, meta.workspace, clientId, { sentiment }));
      }

      console.log(`[sync] filter=${filter} p=${page}: items=${items.length} running=${allRows.length}`);
      if (items.length < 100 || !data?.next_starting_after) break;
      cursor = data.next_starting_after as string;
    }
  }

  console.log(`[sync] total positive leads=${allRows.length}`);

  // ── Selective clean-up: only remove unworked leads (status = 'new') ───────
  // Leads the user has moved forward (booked, qualified, proposal, won, lost)
  // are preserved — their CRM work is never overwritten by a sync.
  // This clears stale/wrong leads from the previous sync without nuking the pipeline.
  {
    let delQ = (supabase.from("leads") as any)
      .delete()
      .eq("source", "instantly")
      .eq("status", "new");
    if (clientId) delQ = delQ.eq("client_id", clientId);
    else          delQ = delQ.is("client_id", null);
    const { error: delErr } = await delQ;
    if (delErr) console.error("[sync] selective delete error:", delErr.message);
    else console.log("[sync] selective delete done (new-status only)");
  }

  // ── Upsert positive leads ─────────────────────────────────────────────────
  // `status` is intentionally absent from leadToRow — so on conflict (existing
  // lead), only Instantly-controlled fields update (sentiment, name, company,
  // campaign) while the user's CRM stage (booked/qualified/etc.) is untouched.
  let totalSynced = 0;
  for (let i = 0; i < allRows.length; i += 50) {
    const chunk = allRows.slice(i, i + 50);
    const { error } = await supabase
      .from("leads")
      .upsert(chunk, { onConflict: "email", ignoreDuplicates: false });
    if (error) console.error("[sync] upsert error:", error.message);
    else totalSynced += chunk.length;
  }

  console.log(`[sync] done. synced=${totalSynced}`);
  return {
    synced: totalSynced,
    total_rows: totalSynced,
    skipped_ooo: 0,
    skipped_negative: 0,
    threads: 0,
    campaignCount: campaignMap.size,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── TEST CONNECTION ───────────────────────────────────────────────────
    if (action === "test_connection") {
      let apiKey = DEFAULT_INSTANTLY_KEY;

      if (payload?.api_key) {
        apiKey = payload.api_key as string;
      } else if (payload?.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("instantly_api_key, name")
          .eq("id", payload.client_id)
          .single();
        if (!client?.instantly_api_key) {
          return new Response(JSON.stringify({ ok: false, error: "Client has no API key" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        apiKey = client.instantly_api_key;
      }

      const instantly = makeInstantly(apiKey);
      const data = await instantly("/campaigns?limit=5");

      if (data?._error) {
        const status = data._status as number;
        const errMsg = status === 401 || status === 403
          ? "Invalid or expired API key"
          : `API error (HTTP ${status})`;
        return new Response(JSON.stringify({ ok: false, error: errMsg }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const campaigns = data?.items ?? [];
      const workspace = campaigns[0]?.workspace_name ?? campaigns[0]?.workspace ?? "Unknown workspace";
      return new Response(JSON.stringify({
        ok: true,
        workspace,
        campaign_count: campaigns.length,
        message: `Connected · ${campaigns.length} campaigns in "${workspace}"`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── TEST MY CONNECTION (default key) ──────────────────────────────────
    if (action === "test_my_connection") {
      const instantly = makeInstantly(DEFAULT_INSTANTLY_KEY);
      const data = await instantly("/campaigns?limit=5");

      if (data?._error) {
        const status = data._status as number;
        const errMsg = status === 401 || status === 403
          ? "Invalid or expired API key"
          : `API error (HTTP ${status})`;
        return new Response(JSON.stringify({ ok: false, error: errMsg }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const campaigns = data?.items ?? [];
      const workspace = campaigns[0]?.workspace_name ?? campaigns[0]?.workspace ?? "Unknown workspace";
      return new Response(JSON.stringify({
        ok: true,
        workspace,
        campaign_count: campaigns.length,
        message: `Connected · ${campaigns.length} campaigns in "${workspace}"`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SYNC ALL LEADS (default account) ──────────────────────────────────
    if (action === "sync_all_leads") {
      const sinceDate = (payload as Record<string, unknown>)?.since_date as string | undefined;
      const result = await runSync(supabase, DEFAULT_INSTANTLY_KEY, null, sinceDate);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SYNC CLIENT LEADS ─────────────────────────────────────────────────
    if (action === "sync_client_leads") {
      const { client_id, since_date } = payload as { client_id: string; since_date?: string };

      const { data: client, error: ce } = await supabase
        .from("clients")
        .select("instantly_api_key, name")
        .eq("id", client_id)
        .single();

      if (ce) throw new Error(`Client lookup failed: ${ce.message}`);
      if (!client) throw new Error(`Client not found: ${client_id}`);
      if (!client.instantly_api_key) throw new Error(`Client "${client.name}" has no Instantly API key configured`);

      console.log(`[sync_client_leads] Starting sync for client: ${client.name} (${client_id}) since=${since_date ?? "all"}`);
      const result = await runSync(supabase, client.instantly_api_key, client_id, since_date);
      return new Response(JSON.stringify({ ...result, client_name: client.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST CLIENTS ──────────────────────────────────────────────────────
    if (action === "list_clients") {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, color, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ clients: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ADD CLIENT ────────────────────────────────────────────────────────
    if (action === "add_client") {
      const { name, instantly_api_key, color } = payload as {
        name: string; instantly_api_key: string; color?: string;
      };
      const { data, error } = await supabase
        .from("clients")
        .insert({ name, instantly_api_key, color: color ?? "primary" })
        .select("id, name, color, created_at")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE CLIENT ─────────────────────────────────────────────────────
    if (action === "delete_client") {
      const { client_id } = payload as { client_id: string };
      const { error } = await supabase.from("clients").delete().eq("id", client_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SYNC THREAD FOR SINGLE LEAD ───────────────────────────────────────
    if (action === "sync_lead_thread") {
      const { lead_id, email, client_id } = payload as {
        lead_id: string; email: string; client_id?: string;
      };

      let apiKey = DEFAULT_INSTANTLY_KEY;
      if (client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("instantly_api_key")
          .eq("id", client_id)
          .single();
        if (client?.instantly_api_key) apiKey = client.instantly_api_key;
      }

      const instantly = makeInstantly(apiKey);
      const emails = await fetchEmailsForLead(instantly, email);
      if (emails.length === 0) {
        return new Response(JSON.stringify({ messages: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const thread = buildEmailThread(lead_id, email, emails);
      if (!thread) {
        return new Response(JSON.stringify({ messages: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("email_threads")
        .upsert(thread, { onConflict: "instantly_thread_id", ignoreDuplicates: false })
        .select()
        .single();

      if (error) {
        console.error("[sync_lead_thread] upsert error:", error.message);
        // Still return the built thread so the UI can display it
        return new Response(JSON.stringify(thread), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ENRICH PHONE ──────────────────────────────────────────────────────
    if (action === "enrich_phone") {
      const { lead_id, name, company, title, email } = payload as {
        lead_id: string; name: string; company: string; title: string; email: string;
      };
      const result = await researchPhoneNumber(name, company, title, email);
      if (result.phone) {
        await supabase.from("leads").update({ phone: result.phone }).eq("id", lead_id);
      }
      return new Response(JSON.stringify({ phone: result.phone, error: result.error ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE LEAD STATUS ────────────────────────────────────────────────
    if (action === "update_lead_status") {
      const { id, status } = payload as { id: string; status: string };
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE LEAD SENTIMENT ─────────────────────────────────────────────
    if (action === "update_sentiment") {
      const { id, sentiment } = payload as { id: string; sentiment: string };
      const { error } = await supabase.from("leads").update({ sentiment }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE LEAD ───────────────────────────────────────────────────────
    if (action === "delete_lead") {
      const { id } = payload as { id: string };
      await supabase.from("email_threads").delete().eq("lead_id", id);
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE LEAD ───────────────────────────────────────────────────────
    if (action === "create_lead") {
      const lead = payload as Record<string, unknown>;
      const { data, error } = await supabase.from("leads").insert(lead).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStack = e instanceof Error ? e.stack : undefined;
    console.error("[instantly-proxy] Unhandled error:", errMsg);
    if (errStack) console.error("[instantly-proxy] Stack:", errStack);
    return new Response(
      JSON.stringify({ error: errMsg, details: errStack ?? null }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
