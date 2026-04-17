import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, Users, Target,
  Phone, Linkedin, Wifi, Zap, DollarSign, ArrowUpRight,
  Loader2, RefreshCw, Eye, Clock, MousePointer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface FathomSite {
  id: string;
  name: string;
}

interface FathomAgg {
  visits: string;
  uniques: string;
  pageviews: string;
  avg_duration: string;
  bounce_rate: string;
}

export default function Analytics() {
  const [sites, setSites] = useState<FathomSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [agg, setAgg] = useState<FathomAgg | null>(null);
  const [currentVisitors, setCurrentVisitors] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sites on mount
  useEffect(() => {
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("fathom-analytics", {
          body: { action: "list_sites" },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        const siteList: FathomSite[] = data?.data ?? data ?? [];
        setSites(Array.isArray(siteList) ? siteList : []);
        if (Array.isArray(siteList) && siteList.length > 0) {
          setSelectedSite(siteList[0].id);
        }
      } catch (e: unknown) {
        console.error("Fathom sites error:", e);
        setError(e instanceof Error ? e.message : "Failed to load Fathom data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load aggregation when site changes
  useEffect(() => {
    if (!selectedSite) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [aggRes, visitorsRes] = await Promise.all([
          supabase.functions.invoke("fathom-analytics", {
            body: { action: "get_aggregation", siteId: selectedSite },
          }),
          supabase.functions.invoke("fathom-analytics", {
            body: { action: "get_current_visitors", siteId: selectedSite },
          }),
        ]);

        if (aggRes.error) throw aggRes.error;
        if (aggRes.data?.error) throw new Error(aggRes.data.error);
        const aggData = Array.isArray(aggRes.data) ? aggRes.data[0] : aggRes.data;
        setAgg(aggData);

        if (!visitorsRes.error && visitorsRes.data) {
          setCurrentVisitors(visitorsRes.data?.total ?? visitorsRes.data?.current_visitors ?? null);
        }
      } catch (e: unknown) {
        console.error("Fathom agg error:", e);
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedSite]);

  const refresh = () => {
    if (selectedSite) {
      setSelectedSite((s) => s); // trigger re-fetch
      // Force by toggling
      const s = selectedSite;
      setSelectedSite(null);
      setTimeout(() => setSelectedSite(s), 50);
    }
  };

  const formatDuration = (secs: string | number) => {
    const s = Number(secs);
    if (isNaN(s) || s <= 0) return "0s";
    if (s < 60) return `${Math.round(s)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  };

  const formatBounce = (rate: string | number) => {
    const r = Number(rate);
    if (isNaN(r)) return "—";
    return `${(r * 100).toFixed(1)}%`;
  };

  return (
    <div className="h-full overflow-y-auto scrollable px-6 py-6 space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : error ? "Connection issue" : "Fathom Analytics — Last 30 days"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sites.length > 1 && (
            <select
              value={selectedSite ?? ""}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="h-8 rounded-md border border-white/15 bg-transparent text-foreground text-xs px-2"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <Button
            onClick={refresh}
            variant="ghost"
            size="sm"
            disabled={loading}
            className="border border-white/15 text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 border-red-500/20 animate-fade-up">
          <p className="text-sm text-red-400">⚠️ {error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Check that your Fathom API key is valid and has read access.
          </p>
        </div>
      )}

      {/* KPIs from Fathom */}
      <div className="grid grid-cols-5 gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        {[
          {
            label: "Unique Visitors",
            value: agg ? Number(agg.uniques).toLocaleString() : "—",
            icon: Users,
            color: "text-primary",
            bg: "bg-primary/10",
            border: "border-primary/25",
          },
          {
            label: "Total Visits",
            value: agg ? Number(agg.visits).toLocaleString() : "—",
            icon: Eye,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/25",
          },
          {
            label: "Pageviews",
            value: agg ? Number(agg.pageviews).toLocaleString() : "—",
            icon: MousePointer,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/25",
          },
          {
            label: "Avg Duration",
            value: agg ? formatDuration(agg.avg_duration) : "—",
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/25",
          },
          {
            label: "Bounce Rate",
            value: agg ? formatBounce(agg.bounce_rate) : "—",
            icon: TrendingUp,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/25",
          },
        ].map((s) => (
          <div key={s.label} className={cn("glass-card p-4 border", s.border)}>
            <div className="flex items-start justify-between mb-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "…" : s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Current visitors */}
      {currentVisitors !== null && (
        <div className="glass-card p-4 border-primary/20 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-foreground">
              {currentVisitors} {currentVisitors === 1 ? "visitor" : "visitors"} on your site right now
            </span>
          </div>
        </div>
      )}

      {/* Site info */}
      {selectedSite && sites.length > 0 && (
        <div className="glass-card p-4 animate-fade-up" style={{ animationDelay: "180ms" }}>
          <p className="text-xs text-muted-foreground">
            Showing data for <span className="text-foreground font-medium">{sites.find(s => s.id === selectedSite)?.name ?? selectedSite}</span>
            {" "}· Site ID: <span className="font-mono text-foreground/70">{selectedSite}</span>
          </p>
        </div>
      )}
    </div>
  );
}
