import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap,
  Search,
  Loader2,
  RefreshCw,
  Mail,
  Building2,
  User,
  Tag,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InstantlyLead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  title?: string;
  status: string;
  source: string;
  sub_account?: string;
  campaign_name?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
}

interface SubAccountGroup {
  name: string;
  color: string;
  leads: InstantlyLead[];
  campaigns: string[];
}

const SUB_ACCOUNT_COLORS = [
  "hsl(163 72% 42%)",   // teal-green
  "hsl(210 85% 55%)",   // blue
  "hsl(270 65% 60%)",   // purple
  "hsl(35 90% 55%)",    // amber
  "hsl(340 65% 55%)",   // rose
  "hsl(142 70% 45%)",   // emerald
  "hsl(190 80% 50%)",   // cyan
  "hsl(25 85% 55%)",    // orange
];

export default function InstantlyView() {
  const [leads, setLeads] = useState<InstantlyLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);
  const [search, setSearch] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set()
  );
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set()
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data as unknown as InstantlyLead[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "instantly-proxy",
        {
          body: { action: "sync_all_leads" },
        }
      );
      if (error) throw error;
      setSyncResult(data as { synced: number });
      await loadLeads();
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  // Group leads by sub_account / campaign_name
  const subAccountGroups = leads.reduce<Record<string, SubAccountGroup>>(
    (acc, lead) => {
      const accountName = lead.sub_account || lead.campaign_name || "Unsorted";
      if (!acc[accountName]) {
        const idx = Object.keys(acc).length % SUB_ACCOUNT_COLORS.length;
        acc[accountName] = {
          name: accountName,
          color: SUB_ACCOUNT_COLORS[idx],
          leads: [],
          campaigns: [],
        };
      }
      acc[accountName].leads.push(lead);
      if (
        lead.campaign_name &&
        !acc[accountName].campaigns.includes(lead.campaign_name)
      ) {
        acc[accountName].campaigns.push(lead.campaign_name);
      }
      return acc;
    },
    {}
  );

  const filteredGroups = Object.values(subAccountGroups).map((group) => ({
    ...group,
    leads: group.leads.filter(
      (l) =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase()) ||
        (l.company || "").toLowerCase().includes(search.toLowerCase())
    ),
  }));

  const totalLeads = leads.length;
  const totalAccounts = Object.keys(subAccountGroups).length;

  const toggleAccount = (name: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleCampaign = (key: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3 flex-shrink-0 animate-fade-up">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Zap size={20} className="text-primary" />
            Instantly Sync
          </h1>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : `${totalLeads} leads across ${totalAccounts} sub-accounts`}
            {syncResult && !syncing && (
              <span className="ml-1.5 text-primary">
                · {syncResult.synced} synced
              </span>
            )}
          </p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all leads..."
            className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50 pl-9 w-56 h-8 text-sm"
          />
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary h-8 text-sm font-semibold gap-1.5"
        >
          {syncing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {syncing ? "Syncing All…" : "Sync All Sub-Accounts"}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollable p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Zap size={36} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">
              No leads synced yet
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Click "Sync All Sub-Accounts" to pull leads from Instantly
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = expandedAccounts.has(group.name);
            return (
              <div
                key={group.name}
                className="glass-card overflow-hidden animate-fade-up"
              >
                {/* Sub-account header */}
                <button
                  onClick={() => toggleAccount(group.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm font-semibold text-foreground flex-1 text-left">
                    {group.name}
                  </span>
                  <span className="text-xs text-muted-foreground bg-white/8 px-2 py-0.5 rounded-full">
                    {group.leads.length} leads
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.campaigns.length} campaigns
                  </span>
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-muted-foreground" />
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground" />
                  )}
                </button>

                {/* Expanded: show campaigns and leads */}
                {isExpanded && (
                  <div className="border-t border-white/5">
                    {/* Campaign groups */}
                    {group.campaigns.length > 0 ? (
                      group.campaigns.map((campaign) => {
                        const campaignKey = `${group.name}:${campaign}`;
                        const campaignLeads = group.leads.filter(
                          (l) => l.campaign_name === campaign
                        );
                        const isCampaignExpanded =
                          expandedCampaigns.has(campaignKey);

                        return (
                          <div key={campaignKey}>
                            <button
                              onClick={() => toggleCampaign(campaignKey)}
                              className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-white/3 transition-colors border-b border-white/3"
                            >
                              <Tag
                                size={12}
                                className="text-muted-foreground"
                              />
                              <span className="text-xs font-medium text-muted-foreground flex-1 text-left truncate">
                                {campaign}
                              </span>
                              <span className="text-[11px] text-muted-foreground/60">
                                {campaignLeads.length}
                              </span>
                              {isCampaignExpanded ? (
                                <ChevronDown
                                  size={12}
                                  className="text-muted-foreground/50"
                                />
                              ) : (
                                <ChevronRight
                                  size={12}
                                  className="text-muted-foreground/50"
                                />
                              )}
                            </button>
                            {isCampaignExpanded && (
                              <div className="divide-y divide-white/3">
                                {campaignLeads.map((lead) => (
                                  <LeadRow
                                    key={lead.id}
                                    lead={lead}
                                    color={group.color}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="divide-y divide-white/3">
                        {group.leads.map((lead) => (
                          <LeadRow
                            key={lead.id}
                            lead={lead}
                            color={group.color}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  color,
}: {
  lead: InstantlyLead;
  color: string;
}) {
  const statusColor =
    lead.status === "won"
      ? "text-emerald-400"
      : lead.status === "lost"
        ? "text-red-400"
        : lead.status === "qualified"
          ? "text-purple-400"
          : lead.status === "booked"
            ? "text-blue-400"
            : "text-primary";

  return (
    <div className="flex items-center gap-3 px-8 py-2.5 hover:bg-white/3 transition-colors">
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {lead.name}
          </span>
          {lead.company && (
            <span className="text-xs text-muted-foreground/70 truncate flex items-center gap-1">
              <Building2 size={10} />
              {lead.company}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground/50 flex items-center gap-1 truncate">
            <Mail size={10} />
            {lead.email}
          </span>
          {lead.title && (
            <span className="text-xs text-muted-foreground/40 truncate flex items-center gap-1">
              <User size={10} />
              {lead.title}
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize",
          statusColor,
          "border-current/20 bg-current/5"
        )}
      >
        {lead.status}
      </span>
      <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
        <Clock size={10} />
        {new Date(lead.created_at).toLocaleDateString()}
      </span>
    </div>
  );
}
