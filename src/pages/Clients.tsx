import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Plus, Zap, Loader2, Trash2, Users, Building2, Check } from "lucide-react";

interface Client {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  leadCount?: number;
}

const COLOR_OPTIONS = [
  { value: "primary", label: "Green",  cls: "bg-primary" },
  { value: "blue",    label: "Blue",   cls: "bg-blue-500" },
  { value: "purple",  label: "Purple", cls: "bg-purple-500" },
  { value: "amber",   label: "Amber",  cls: "bg-amber-500" },
  { value: "rose",    label: "Rose",   cls: "bg-rose-500" },
];

const COLOR_BADGE: Record<string, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  blue:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  purple:  "bg-purple-500/15 text-purple-400 border-purple-500/30",
  amber:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rose:    "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const COLOR_DOT: Record<string, string> = {
  primary: "bg-primary",
  blue:    "bg-blue-500",
  purple:  "bg-purple-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newColor, setNewColor] = useState("primary");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    const { data: clientData } = await (supabase as any)
      .from("clients")
      .select("id, name, color, created_at")
      .order("created_at");

    if (!clientData) { setLoading(false); return; }

    // Count leads per client
    const { data: leadCounts } = await supabase
      .from("leads")
      .select("client_id")
      .not("client_id", "is", null);

    const counts: Record<string, number> = {};
    for (const l of leadCounts ?? []) {
      if (l.client_id) counts[l.client_id] = (counts[l.client_id] ?? 0) + 1;
    }

    setClients(clientData.map((c: Client) => ({ ...c, leadCount: counts[c.id] ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncClient(clientId: string) {
    setSyncing(clientId);
    setSyncResults((prev) => ({ ...prev, [clientId]: "" }));
    try {
      const { data, error } = await supabase.functions.invoke("instantly-proxy", {
        body: { action: "sync_client_leads", payload: { client_id: clientId } },
      });
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      const parts = [`${data.total_rows ?? data.synced ?? 0} leads synced`];
      if (data.skipped_ooo) parts.push(`${data.skipped_ooo} OOO filtered`);
      if (data.skipped_negative) parts.push(`${data.skipped_negative} negative filtered`);
      setSyncResults((prev) => ({ ...prev, [clientId]: parts.join(" · ") }));
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncResults((prev) => ({ ...prev, [clientId]: `Error: ${msg}` }));
    } finally {
      setSyncing(null);
    }
  }

  async function testConnection() {
    if (!newKey.trim()) return;
    setTestingKey(true);
    setKeyTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("instantly-proxy", {
        body: { action: "test_connection", payload: { api_key: newKey.trim() } },
      });
      if (error) throw error;
      setKeyTestResult({ ok: data.ok, message: data.ok ? data.message : `Failed: ${data.error}` });
    } catch (e: any) {
      setKeyTestResult({ ok: false, message: `Error: ${e.message}` });
    } finally {
      setTestingKey(false);
    }
  }

  async function addClient() {
    if (!newName.trim() || !newKey.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const { data, error } = await supabase.functions.invoke("instantly-proxy", {
        body: {
          action: "add_client",
          payload: { name: newName.trim(), instantly_api_key: newKey.trim(), color: newColor },
        },
      });
      if (error) {
        let msg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch {}
        throw new Error(msg);
      }
      setClients((prev) => [...prev, { ...data, leadCount: 0 }]);
      setNewName(""); setNewKey(""); setNewColor("primary");
      setAddError(null);
      setShowAdd(false);
    } catch (e: any) {
      setAddError(e.message ?? "Failed to add client");
    } finally {
      setAdding(false);
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client? Their leads will remain but be unlinked.")) return;
    await supabase.functions.invoke("instantly-proxy", {
      body: { action: "delete_client", payload: { client_id: id } },
    });
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3 flex-shrink-0 animate-fade-up">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Clients</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${clients.length} client account${clients.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex-1" />
        <Button
          onClick={() => setShowAdd((v) => !v)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary h-8 text-sm font-semibold gap-1.5"
        >
          <Plus size={14} />
          Add Client
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollable p-6 space-y-4">
        {/* Add form */}
        {showAdd && (
          <div className="glass-card p-5 border border-primary/20 animate-fade-up space-y-4">
            <p className="text-sm font-semibold text-foreground">New Client Account</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Client Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. AimLogic"
                  className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Instantly API Key</label>
                <Input
                  value={newKey}
                  onChange={(e) => { setNewKey(e.target.value); setKeyTestResult(null); }}
                  placeholder="Paste API key…"
                  type="password"
                  className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={testConnection}
                disabled={testingKey || !newKey.trim()}
                variant="ghost"
                className="glass glass-hover border-white/15 h-8 text-xs gap-1.5"
              >
                {testingKey ? <Loader2 size={12} className="animate-spin text-primary" /> : <Zap size={12} className="text-primary" />}
                {testingKey ? "Testing…" : "Test Connection"}
              </Button>
              {keyTestResult && (
                <span className={cn("text-xs font-medium", keyTestResult.ok ? "text-emerald-400" : "text-red-400")}>
                  {keyTestResult.ok ? "✓" : "✗"} {keyTestResult.message}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className={cn("w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all", c.cls,
                      newColor === c.value ? "border-white/60 scale-110" : "border-transparent opacity-60"
                    )}
                  >
                    {newColor === c.value && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={addClient}
                disabled={adding || !newName.trim() || !newKey.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-sm gap-1.5"
              >
                {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {adding ? "Adding…" : "Add Client"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowAdd(false); setAddError(null); }} className="h-8 text-sm text-muted-foreground">
                Cancel
              </Button>
              {addError && (
                <span className="text-xs text-red-400 ml-1">✗ {addError}</span>
              )}
            </div>
          </div>
        )}

        {/* Client cards */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <Building2 size={32} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No clients yet. Add one to start syncing their leads.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-w-2xl">
            {clients.map((client) => {
              const color = client.color ?? "primary";
              const isSyncing = syncing === client.id;
              const result = syncResults[client.id];
              return (
                <div key={client.id} className="glass-card p-4 flex items-center gap-4 animate-fade-up">
                  {/* Color dot / avatar */}
                  <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0",
                    COLOR_BADGE[color] ?? COLOR_BADGE.primary)}>
                    <span className="text-sm font-bold">
                      {client.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground">{client.name}</p>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border",
                        COLOR_BADGE[color] ?? COLOR_BADGE.primary)}>
                        {color}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users size={10} />
                        {client.leadCount ?? 0} leads
                      </span>
                      <span>Added {new Date(client.created_at).toLocaleDateString()}</span>
                    </div>
                    {result && (
                      <p className={cn("text-[11px] mt-1", result.startsWith("Error") ? "text-red-400" : "text-primary")}>
                        {result}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => syncClient(client.id)}
                      disabled={!!syncing}
                      variant="ghost"
                      className="glass glass-hover border-white/15 text-foreground h-8 text-xs gap-1.5"
                    >
                      {isSyncing
                        ? <Loader2 size={12} className="animate-spin text-primary" />
                        : <Zap size={12} className="text-primary" />
                      }
                      {isSyncing ? "Syncing…" : "Sync Leads"}
                    </Button>
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete client"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
