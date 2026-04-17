import { useState, useEffect, useCallback } from "react";
import { STATUS_COLUMN_ORDER, STATUS_LABELS, LeadStatus, LeadSentiment } from "@/lib/data";
import LeadCard from "@/components/LeadCard";
import LeadDetailModal from "@/components/LeadDetailModal";
import AddLeadModal from "@/components/AddLeadModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lead, LeadSource } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

const VALID_STATUSES: Lead["status"][] = ["new", "booked", "qualified", "proposal", "won", "lost"];

function normalizeStatus(s: unknown): Lead["status"] {
  if (s === "contacted") return "booked";
  if (typeof s === "string" && VALID_STATUSES.includes(s as Lead["status"])) return s as Lead["status"];
  return "new";
}

function normalizeSentiment(s: unknown): LeadSentiment {
  if (s === "interested" || s === "follow_up" || s === "opportunity" || s === "negative" || s === "neutral") return s;
  return "interested"; // default: all synced leads are interested
}

function dbToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    name: row.name as string,
    company: (row.company as string) || "—",
    email: (row.email as string) || "",
    phone: row.phone as string | undefined,
    title: row.title as string | undefined,
    source: (row.source as LeadSource) || "instantly",
    status: normalizeStatus(row.status),
    sentiment: normalizeSentiment(row.sentiment),
    notes: row.notes as string | undefined,
    linkedinUrl: row.linkedin_url as string | undefined,
    value: row.value ? Number(row.value) : undefined,
    tags: row.tags as string[] | undefined,
    createdAt: (row.created_at as string)?.split("T")[0] ?? "",
    lastContacted: row.last_contacted as string | undefined,
    clientId: row.client_id as string | undefined,
    subAccount: row.sub_account as string | undefined,
  };
}

const STATUS_COLUMN_STYLES: Record<LeadStatus, { header: string; dot: string; drop: string }> = {
  new:      { header: "text-primary border-primary/30",         dot: "bg-primary",     drop: "ring-primary/40 bg-primary/5" },
  booked:   { header: "text-blue-400 border-blue-400/30",       dot: "bg-blue-400",    drop: "ring-blue-400/40 bg-blue-400/5" },
  qualified:{ header: "text-purple-400 border-purple-400/30",   dot: "bg-purple-400",  drop: "ring-purple-400/40 bg-purple-400/5" },
  proposal: { header: "text-amber-400 border-amber-400/30",     dot: "bg-amber-400",   drop: "ring-amber-400/40 bg-amber-400/5" },
  won:      { header: "text-emerald-400 border-emerald-400/30", dot: "bg-emerald-400", drop: "ring-emerald-400/40 bg-emerald-400/5" },
  lost:     { header: "text-red-400 border-red-400/30",         dot: "bg-red-400",     drop: "ring-red-400/40 bg-red-400/5" },
};

const COLOR_DOT: Record<string, string> = {
  primary: "bg-primary",
  blue:    "bg-blue-500",
  purple:  "bg-purple-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
};

interface ClientAccount {
  id: string;       // "mine" for default account, uuid for client accounts
  name: string;
  color: string;
  instantly_api_key?: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [activeClient, setActiveClient] = useState<ClientAccount | null>(null); // null = my account
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "company">("oldest");
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);
  const [syncDays, setSyncDays] = useState<number>(30); // default: last 30 days

  const loadLeads = useCallback(async (clientId?: string | null) => {
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (clientId === null) {
      // My account = leads with no client_id
      query = query.is("client_id", null);
    } else if (clientId) {
      query = query.eq("client_id", clientId);
    }
    const { data, error } = await query;
    if (!error && data) setLeads(data.map(dbToLead));
  }, []);

  const loadClients = useCallback(async () => {
    const { data } = await (supabase as any).from("clients").select("id, name, color").order("created_at");
    if (data) setClients(data as ClientAccount[]);
  }, []);

  // Sync the active account (my account or a specific client)
  const runSync = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true);
    setSyncMsg(null);
    try {
      let result: any;
      const sinceDate = new Date(Date.now() - syncDays * 24 * 60 * 60 * 1000).toISOString();
      const invokeOpts = activeClient
        ? { body: { action: "sync_client_leads", payload: { client_id: activeClient.id, since_date: sinceDate } } }
        : { body: { action: "sync_all_leads", payload: { since_date: sinceDate } } };

      const { data, error } = await supabase.functions.invoke("instantly-proxy", invokeOpts);

      if (error) {
        // Try to extract the actual error message from the response body
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      result = data;
      const parts = [`${result.total_rows ?? result.synced ?? 0} leads synced`];
      if (result.sample_lead) {
        // Log the raw lead object so we can see the real Instantly field names
        console.log("INSTANTLY SAMPLE LEAD:", JSON.stringify(result.sample_lead, null, 2));
      }
      setSyncMsg(parts.join(" · "));
      await loadLeads(activeClient?.id ?? null);
    } catch (e: any) {
      console.error("Sync error:", e);
      setSyncMsg(`Error: ${e.message}`);
    } finally {
      if (!silent) setSyncing(false);
    }
  }, [activeClient, loadLeads]);

  // On mount
  useEffect(() => {
    (async () => {
      setLoadingLeads(true);
      await Promise.all([loadLeads(null), loadClients()]);
      setLoadingLeads(false);
    })();
  }, []);

  // Switch client account
  const switchClient = useCallback(async (client: ClientAccount | null) => {
    setActiveClient(client);
    setSyncMsg(null);
    setSentimentFilter("all");
    setSearch("");
    setLoadingLeads(true);
    await loadLeads(client?.id ?? null);
    setLoadingLeads(false);
  }, [loadLeads]);

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await supabase.from("leads").update({ status }).eq("id", id);
  };

  const handleSentimentChange = async (id: string, sentiment: LeadSentiment) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, sentiment } : l)));
    await (supabase.from("leads") as any).update({ sentiment }).eq("id", id);
  };

  const handleDelete = async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("email_threads").delete().eq("lead_id", id);
    await supabase.from("leads").delete().eq("id", id);
  };

  const handleNotesChange = (id: string, notes: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, notes } : l)));
  };

  const handleAdd = async (lead: Lead) => {
    const row = {
      name: lead.name, company: lead.company, email: lead.email,
      phone: lead.phone ?? null, title: lead.title ?? null,
      source: lead.source, status: lead.status,
      sentiment: lead.sentiment ?? "interested",
      notes: lead.notes ?? null, linkedin_url: lead.linkedinUrl ?? null,
      value: lead.value ?? null, tags: lead.tags ?? null,
      client_id: activeClient?.id ?? null,
    };
    const { data, error } = await (supabase.from("leads") as any).insert(row).select().single();
    if (!error && data) setLeads((prev) => [dbToLead(data), ...prev]);
  };

  // Drag-and-drop
  function onDragOver(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }
  function onDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData("lead_id");
    if (id) handleStatusChange(id, status);
  }

  // Filter + sort
  const filtered = leads
    .filter((l) => {
      const matchSearch =
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.company.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase());
      const matchSentiment = sentimentFilter === "all" || l.sentiment === sentimentFilter;
      const matchSource = sourceFilter === "all" || l.source === sourceFilter;
      return matchSearch && matchSentiment && matchSource;
    })
    .sort((a, b) => {
      if (sortOrder === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortOrder === "company") return a.company.localeCompare(b.company);
      return b.createdAt.localeCompare(a.createdAt);
    });

  const byStatus = (status: LeadStatus) => filtered.filter((l) => l.status === status);
  const negCount = leads.filter((l) => l.sentiment === "negative").length;

  return (
    <div className="h-full flex flex-col">

      {/* ── Client account switcher ───────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-0 border-b border-white/8 flex items-center gap-2 flex-shrink-0 flex-wrap">
        {/* My account pill */}
        <button
          onClick={() => switchClient(null)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
            !activeClient
              ? "bg-primary/20 text-primary border-primary/40 shadow-[0_0_12px_hsla(163,72%,42%,0.2)]"
              : "text-muted-foreground border-white/10 hover:border-white/20 hover:text-foreground"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          My Pipeline
          {!activeClient && (
            <span className="text-[10px] bg-primary/20 px-1.5 rounded-full">{leads.length}</span>
          )}
        </button>

        {/* Client pills */}
        {clients.map((c) => {
          const isActive = activeClient?.id === c.id;
          const dotClass = COLOR_DOT[c.color ?? "primary"] ?? "bg-primary";
          return (
            <button
              key={c.id}
              onClick={() => switchClient(c)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                isActive
                  ? "bg-white/10 text-foreground border-white/30"
                  : "text-muted-foreground border-white/10 hover:border-white/20 hover:text-foreground"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotClass)} />
              {c.name}
              {isActive && (
                <span className="text-[10px] bg-white/15 px-1.5 rounded-full">{leads.length}</span>
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Date range + sync */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <select
            value={syncDays}
            onChange={(e) => setSyncDays(Number(e.target.value))}
            className="h-7 text-xs rounded-md border border-white/15 bg-transparent text-muted-foreground px-2 focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 3 months</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 12 months</option>
            <option value={9999}>All time</option>
          </select>
          <Button
            onClick={() => runSync(false)}
            disabled={syncing}
            variant="ghost"
            size="sm"
            className="glass glass-hover border-white/15 text-foreground h-7 text-xs gap-1.5"
          >
            {syncing ? <Loader2 size={11} className="animate-spin text-primary" /> : <Zap size={11} className="text-primary" />}
            {syncing ? "Syncing…" : `Sync ${activeClient?.name ?? "My Account"}`}
          </Button>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-white/8 flex items-center gap-2 flex-shrink-0 flex-wrap animate-fade-up">
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight">
            {activeClient ? `${activeClient.name} Pipeline` : "My Pipeline"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {loadingLeads ? "Loading…" : `${leads.length} leads`}
            {syncMsg && !syncing && (
              <span className={cn("ml-1.5", syncMsg.startsWith("Error") ? "text-red-400" : "text-primary")}>
                · {syncMsg}
              </span>
            )}
          </p>
        </div>

        <div className="flex-1" />

        {/* Sentiment pills */}
        <div className="flex items-center gap-1">
          {([
            { key: "all",      label: "All",       active: "bg-white/10 text-foreground border-white/25" },
            { key: "negative", label: `✗ ${negCount}`, active: "bg-red-500/15 text-red-400 border-red-500/30" },
          ] as const).map(({ key, label, active }) => (
            <button
              key={key}
              onClick={() => setSentimentFilter(sentimentFilter === key ? "all" : key)}
              className={cn(
                "text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap",
                sentimentFilter === key
                  ? active
                  : "bg-transparent text-muted-foreground border-white/10 hover:border-white/20 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Source */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="glass border border-white/15 bg-[hsl(var(--background))] text-foreground text-xs h-7 px-2 rounded-md focus:outline-none"
        >
          <option value="all">All Sources</option>
          <option value="instantly">Instantly</option>
          <option value="linkedin">LinkedIn</option>
          <option value="cold_call">Cold Call</option>
          <option value="networking">Networking</option>
        </select>

        {/* Sort */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as any)}
          className="glass border border-white/15 bg-[hsl(var(--background))] text-foreground text-xs h-7 px-2 rounded-md focus:outline-none"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="company">By Company</option>
        </select>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 pl-7 w-40 h-7 text-xs"
          />
        </div>

        <Button
          onClick={() => setAddOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary h-7 text-xs font-semibold gap-1.5"
        >
          <Plus size={12} />
          Add Lead
        </Button>
      </div>

      {/* ── Kanban ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {loadingLeads ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-3 h-full p-4 min-w-max">
            {STATUS_COLUMN_ORDER.map((status, i) => {
              const col = byStatus(status);
              const style = STATUS_COLUMN_STYLES[status];
              const isDragOver = dragOverCol === status;
              return (
                <div
                  key={status}
                  className={cn(
                    "w-64 flex flex-col h-full animate-fade-up rounded-xl transition-all duration-150",
                    isDragOver && `ring-2 ${style.drop}`
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                  onDragOver={(e) => onDragOver(e, status)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => onDrop(e, status)}
                >
                  <div className={cn("glass-card mb-2 px-3 py-2.5 flex items-center gap-2 border", style.header)}>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", style.dot)} />
                    <span className="text-xs font-semibold flex-1">{STATUS_LABELS[status]}</span>
                    <span className="text-xs text-muted-foreground bg-white/8 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {col.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollable space-y-2 pr-0.5">
                    {col.length === 0 ? (
                      <div className={cn(
                        "flex items-center justify-center h-20 rounded-lg border-2 border-dashed transition-colors",
                        isDragOver ? "border-white/20" : "border-white/8 opacity-40"
                      )}>
                        <p className="text-[11px] text-muted-foreground">
                          {isDragOver ? "Drop here" : "No leads"}
                        </p>
                      </div>
                    ) : (
                      col.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onClick={setSelectedLead}
                          onDelete={handleDelete}
                          onSentimentChange={handleSentimentChange}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LeadDetailModal
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={handleStatusChange}
        onSentimentChange={handleSentimentChange}
        onDelete={(id) => { handleDelete(id); setSelectedLead(null); }}
        onNotesChange={handleNotesChange}
      />
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
    </div>
  );
}
