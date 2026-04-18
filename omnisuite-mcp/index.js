import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write("Error: SUPABASE_URL and SUPABASE_KEY env vars are required\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = new Server(
  { name: "omnisuite-crm", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_leads",
      description: "List CRM leads. Filter by status, sentiment, client, or source. Returns up to 50 by default.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["new", "booked", "qualified", "proposal", "won", "lost"], description: "Filter by pipeline status" },
          sentiment: { type: "string", enum: ["interested", "opportunity", "negative", "neutral"], description: "Filter by sentiment" },
          client_id: { type: "string", description: "Filter by client UUID" },
          source: { type: "string", enum: ["cold_call", "linkedin", "networking", "instantly"] },
          limit: { type: "number", description: "Max results (default 50, max 200)" },
        },
      },
    },
    {
      name: "search_leads",
      description: "Search leads by name, email, or company (case-insensitive partial match).",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term to match against name, email, or company" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_lead",
      description: "Get full details of a single lead including notes and tags.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Lead UUID" },
          email: { type: "string", description: "Lead email address (alternative to id)" },
        },
      },
    },
    {
      name: "update_lead",
      description: "Update a lead's status, sentiment, notes, phone, value, or tags.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Lead UUID" },
          email: { type: "string", description: "Lead email (alternative to id)" },
          status: { type: "string", enum: ["new", "booked", "qualified", "proposal", "won", "lost"] },
          sentiment: { type: "string", enum: ["interested", "opportunity", "negative", "neutral"] },
          notes: { type: "string" },
          phone: { type: "string" },
          value: { type: "number", description: "Deal value in dollars" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    {
      name: "add_note",
      description: "Append a note to a lead (non-destructive — appends to existing notes).",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Lead UUID" },
          email: { type: "string", description: "Lead email (alternative to id)" },
          note: { type: "string", description: "Note text to append" },
        },
        required: ["note"],
      },
    },
    {
      name: "log_follow_up",
      description: "Log a follow-up message sent to a lead.",
      inputSchema: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead UUID" },
          message: { type: "string", description: "The follow-up message that was sent" },
          template_name: { type: "string", description: "Template name used (e.g. omniconnex, omnishakespeare)" },
        },
        required: ["lead_id", "message"],
      },
    },
    {
      name: "list_clients",
      description: "List all CRM clients (sub-accounts) with their lead counts.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_pipeline_summary",
      description: "Get a count breakdown of leads by status and sentiment — a quick pipeline snapshot.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_email_thread",
      description: "Get the email conversation thread for a specific lead.",
      inputSchema: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead UUID" },
        },
        required: ["lead_id"],
      },
    },
    {
      name: "sync_leads",
      description: "Trigger an Instantly.ai lead sync. Pass a client_id to sync one client, or omit to sync all.",
      inputSchema: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID to sync (omit for all clients)" },
          instantly_api_key: { type: "string", description: "Instantly API key (only needed if syncing all without a default key)" },
        },
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {

      case "list_leads": {
        let q = supabase.from("leads").select("id,name,email,company,title,status,sentiment,source,client_id,last_contacted,value,phone,notes,tags,created_at").order("created_at", { ascending: false }).limit(Math.min(args?.limit ?? 50, 200));
        if (args?.status)    q = q.eq("status", args.status);
        if (args?.sentiment) q = q.eq("sentiment", args.sentiment);
        if (args?.client_id) q = q.eq("client_id", args.client_id);
        if (args?.source)    q = q.eq("source", args.source);
        const { data, error } = await q;
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "search_leads": {
        const q = args.query;
        const { data, error } = await supabase
          .from("leads")
          .select("id,name,email,company,title,status,sentiment,phone,notes,value,created_at")
          .or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_lead": {
        let q = supabase.from("leads").select("*");
        if (args?.id)    q = q.eq("id", args.id);
        else if (args?.email) q = q.eq("email", args.email);
        else throw new Error("Provide id or email");
        const { data, error } = await q.single();
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "update_lead": {
        const { id, email, ...updates } = args ?? {};
        if (!id && !email) throw new Error("Provide id or email");
        const allowed = ["status","sentiment","notes","phone","value","tags","title","linkedin_url"];
        const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
        if (Object.keys(patch).length === 0) throw new Error("No valid fields to update");
        patch.updated_at = new Date().toISOString();
        let q = supabase.from("leads").update(patch);
        if (id)    q = q.eq("id", id);
        else       q = q.eq("email", email);
        const { data, error } = await q.select().single();
        if (error) throw error;
        return { content: [{ type: "text", text: `Updated lead: ${JSON.stringify(data, null, 2)}` }] };
      }

      case "add_note": {
        const { id, email, note } = args ?? {};
        if (!id && !email) throw new Error("Provide id or email");
        // Fetch existing notes first
        let fetchQ = supabase.from("leads").select("id,notes");
        if (id) fetchQ = fetchQ.eq("id", id);
        else    fetchQ = fetchQ.eq("email", email);
        const { data: lead, error: fetchErr } = await fetchQ.single();
        if (fetchErr) throw fetchErr;
        const existing = lead.notes ? lead.notes + "\n\n" : "";
        const timestamp = new Date().toLocaleString();
        const newNotes = `${existing}[${timestamp}] ${note}`;
        const { data, error } = await supabase
          .from("leads").update({ notes: newNotes, updated_at: new Date().toISOString() })
          .eq("id", lead.id).select("id,name,notes").single();
        if (error) throw error;
        return { content: [{ type: "text", text: `Note added to ${data.name}` }] };
      }

      case "log_follow_up": {
        const { lead_id, message, template_name } = args ?? {};
        const { data, error } = await supabase.from("follow_up_logs").insert({ lead_id, message, template_name }).select().single();
        if (error) throw error;
        return { content: [{ type: "text", text: `Follow-up logged: ${data.id}` }] };
      }

      case "list_clients": {
        const { data: clients, error } = await supabase.from("clients").select("id,name,color,created_at").order("name");
        if (error) throw error;
        // Fetch lead counts per client
        const counts = await Promise.all(
          clients.map(async (c) => {
            const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("client_id", c.id);
            return { ...c, lead_count: count ?? 0 };
          })
        );
        return { content: [{ type: "text", text: JSON.stringify(counts, null, 2) }] };
      }

      case "get_pipeline_summary": {
        const { data: leads, error } = await supabase.from("leads").select("status,sentiment");
        if (error) throw error;
        const byStatus: Record<string, number> = {};
        const bySentiment: Record<string, number> = {};
        for (const l of leads) {
          byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
          if (l.sentiment) bySentiment[l.sentiment] = (bySentiment[l.sentiment] ?? 0) + 1;
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ total: leads.length, by_status: byStatus, by_sentiment: bySentiment }, null, 2),
          }],
        };
      }

      case "get_email_thread": {
        const { data, error } = await supabase.from("email_threads").select("*").eq("lead_id", args.lead_id).order("last_message_at", { ascending: false }).limit(1).single();
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "sync_leads": {
        const body = args?.client_id
          ? { action: "sync_client_leads", client_id: args.client_id }
          : { action: "sync_all_leads", instantly_api_key: args?.instantly_api_key };
        const res = await fetch(`${SUPABASE_URL}/functions/v1/instantly-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
