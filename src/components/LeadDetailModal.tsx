import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lead, SOURCE_LABELS, STATUS_LABELS, LeadSource, LeadStatus } from "@/lib/data";
import {
  Phone, Linkedin, Building2, Mail, FileText, DollarSign,
  Tag, Clock, MessageSquare, Loader2, RefreshCw, Search,
  ThumbsUp, ThumbsDown, Minus, Trash2, TrendingUp, Bell, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const SOURCE_BADGE_CLASS: Record<LeadSource, string> = {
  cold_call: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  linkedin: "bg-blue-600/15 text-blue-300 border-blue-600/30",
  networking: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  instantly: "bg-primary/15 text-primary border-primary/30",
};

const STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
  new: "bg-primary/15 text-primary border-primary/30",
  booked: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  qualified: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  proposal: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  won: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  lost: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface Message {
  id: string;
  sender: "us" | "them";
  from: string;
  subject: string;
  body: string;
  sent_at: string;
}

interface EmailThread {
  id: string;
  subject: string;
  messages: Message[];
  last_message_at: string | null;
}

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onSentimentChange?: (id: string, sentiment: "interested" | "follow_up" | "opportunity" | "negative" | "neutral") => void;
  onDelete?: (id: string) => void;
  onNotesChange?: (id: string, notes: string) => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/6 last:border-0">
      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon size={11} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// Strip HTML tags for plain text display
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function MessageBubble({ message }: { message: Message }) {
  const isUs = message.sender === "us";
  const body = stripHtml(message.body);
  const date = message.sent_at
    ? new Date(message.sent_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "";

  return (
    <div className={cn("flex flex-col gap-1", isUs ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUs
            ? "bg-primary/20 border border-primary/30 text-foreground rounded-tr-sm"
            : "bg-white/8 border border-white/12 text-foreground rounded-tl-sm"
        )}
      >
        {body || <span className="text-muted-foreground italic text-xs">(empty)</span>}
      </div>
      <p className="text-[10px] text-muted-foreground px-1">{isUs ? "You" : "Them"} · {date}</p>
    </div>
  );
}

const SENTIMENT_CONFIG = {
  follow_up:   { icon: Bell,       label: "Follow Up",   cls: "text-emerald-300 bg-emerald-500/25 border-emerald-400/50" },
  interested:  { icon: ThumbsUp,   label: "Interested",  cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  opportunity: { icon: TrendingUp, label: "Opportunity", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  negative:    { icon: ThumbsDown, label: "Negative",    cls: "text-red-400 bg-red-500/15 border-red-500/30" },
  neutral:     { icon: Minus,      label: "Unclassified",cls: "text-muted-foreground bg-white/6 border-white/12" },
};

export default function LeadDetailModal({ lead, open, onClose, onStatusChange, onSentimentChange, onDelete, onNotesChange }: LeadDetailModalProps) {
  const [thread, setThread] = useState<EmailThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "thread">("thread");
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [localPhone, setLocalPhone] = useState<string | undefined>(lead?.phone);
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !lead) {
      setThread(null);
      return;
    }
    setNotes(lead.notes ?? "");
    setLocalPhone(lead.phone);
    setEnrichError(null);
    loadThread();
  }, [open, lead?.id]);

  function handleNotesChange(val: string) {
    setNotes(val);
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      if (!lead) return;
      await supabase.from("leads").update({ notes: val }).eq("id", lead.id);
      onNotesChange?.(lead.id, val);
    }, 600);
  }

  async function loadThread(forceRefresh = false) {
    if (!lead) return;
    setThreadLoading(true);
    try {
      // 1. Try DB first
      if (!forceRefresh) {
        const { data } = await supabase
          .from("email_threads")
          .select("*")
          .eq("lead_id", lead.id)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .single();

        if (data && (data.messages as Message[]).length > 0) {
          setThread(data as unknown as EmailThread);
          setThreadLoading(false);
          return;
        }
      }

      // 2. Not in DB — fetch from Instantly (pass client_id so the right API key is used)
      const { data, error } = await supabase.functions.invoke("instantly-proxy", {
        body: {
          action: "sync_lead_thread",
          payload: { lead_id: lead.id, email: lead.email, client_id: lead.clientId ?? null },
        },
      });

      if (!error && data && (data.messages as Message[])?.length > 0) {
        setThread(data as EmailThread);
      }
    } catch (e) {
      console.error("Thread load error:", e);
    } finally {
      setThreadLoading(false);
    }
  }

  async function enrichPhone() {
    if (!lead) return;
    setEnriching(true);
    setEnrichError(null);
    try {
      const { data, error } = await supabase.functions.invoke("instantly-proxy", {
        body: {
          action: "enrich_phone",
          payload: {
            lead_id: lead.id,
            name: lead.name,
            company: lead.company,
            title: lead.title ?? "",
            email: lead.email,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.phone) {
        setLocalPhone(data.phone);
      } else {
        setEnrichError(data?.error ?? "No phone number found");
      }
    } catch (e: any) {
      setEnrichError(e.message ?? "Search failed");
    } finally {
      setEnriching(false);
    }
  }

  if (!lead) return null;

  const allStatuses: LeadStatus[] = ["new", "booked", "qualified", "proposal", "won", "lost"];
  const messages: Message[] = (thread?.messages as Message[]) ?? [];
  const themMessages = messages.filter((m) => m.sender === "them");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass border-[hsl(var(--glass-border-bright))] max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">{lead.name}</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                {[lead.title, lead.company].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md border", SOURCE_BADGE_CLASS[lead.source])}>
                {SOURCE_LABELS[lead.source]}
              </span>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md border", STATUS_BADGE_CLASS[lead.status])}>
                {STATUS_LABELS[lead.status]}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("thread")}
              className={cn(
                "text-xs px-3 py-1 rounded-md transition-colors",
                activeTab === "thread"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={11} />
                Thread
                {themMessages.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] px-1 rounded-full leading-4">
                    {themMessages.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("info")}
              className={cn(
                "text-xs px-3 py-1 rounded-md transition-colors",
                activeTab === "info"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Info
            </button>
          </div>
        </div>

        {/* Thread tab */}
        {activeTab === "thread" && (
          <div className="flex-1 overflow-y-auto scrollable px-5 py-3 min-h-0">
            {threadLoading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading conversation…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <MessageSquare size={24} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No emails found for this lead</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs gap-1.5 h-7"
                  onClick={() => loadThread(true)}
                >
                  <RefreshCw size={11} />
                  Try fetching from Instantly
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {thread?.subject && (
                  <p className="text-[11px] text-muted-foreground text-center border-b border-white/6 pb-2">
                    Re: {thread.subject}
                  </p>
                )}
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info tab */}
        {activeTab === "info" && (
          <div className="flex-1 overflow-y-auto scrollable px-5 py-3 min-h-0 space-y-0">
            {lead.email && <InfoRow icon={Mail} label="Email" value={lead.email} />}
            {localPhone ? (
              <div className="flex items-center gap-3 py-2 border-b border-white/6">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone size={11} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</p>
                  <p className="text-sm text-foreground">{localPhone}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground" disabled={enriching} onClick={enrichPhone}>
                  {enriching ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  {enriching ? "Searching…" : "Re-search"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-2 border-b border-white/6">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone size={11} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</p>
                  {enrichError
                    ? <p className="text-xs text-red-400">{enrichError}</p>
                    : <p className="text-xs text-muted-foreground/50 italic">Not found — click to search</p>
                  }
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] gap-1 text-primary hover:text-primary"
                  disabled={enriching}
                  onClick={enrichPhone}
                >
                  {enriching ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  {enriching ? "Searching web…" : "AI Lookup"}
                </Button>
              </div>
            )}
            {lead.linkedinUrl && <InfoRow icon={Linkedin} label="LinkedIn" value={lead.linkedinUrl} />}
            <InfoRow icon={Clock} label="Added to CRM" value={new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
            {lead.lastContacted && (
              <InfoRow
                icon={CalendarDays}
                label="In Instantly since"
                value={new Date(lead.lastContacted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              />
            )}
            {lead.value && (
              <InfoRow icon={DollarSign} label="Deal Value" value={`$${lead.value.toLocaleString()}`} />
            )}
            {/* Editable notes */}
            <div className="pt-2 pb-1">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText size={11} className="text-primary" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</p>
              </div>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add notes about this lead…"
                rows={3}
                className="w-full text-sm text-foreground/90 leading-relaxed bg-white/4 rounded-lg px-3 py-2 border border-white/8 focus:border-primary/40 focus:outline-none resize-none placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>
            {lead.tags && lead.tags.length > 0 && (
              <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                <Tag size={11} className="text-muted-foreground" />
                {lead.tags.map((t) => (
                  <span key={t} className="text-[10px] bg-white/6 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Refresh thread + status bar */}
        <div className="px-5 pb-4 pt-3 border-t border-white/8 flex-shrink-0 space-y-3">
          {activeTab === "thread" && messages.length > 0 && (
            <button
              onClick={() => loadThread(true)}
              className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={10} />
              Refresh from Instantly
            </button>
          )}
          {/* Sentiment row */}
          {onSentimentChange && (() => {
            const sentiment = (lead.sentiment ?? "neutral") as keyof typeof SENTIMENT_CONFIG;
            return (
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Signal</p>
                <div className="flex items-center gap-1">
                  {(["follow_up", "interested", "opportunity", "negative"] as const).map((s) => {
                    const c = SENTIMENT_CONFIG[s];
                    const Icon = c.icon;
                    return (
                      <button
                        key={s}
                        onClick={() => onSentimentChange(lead.id, s)}
                        className={cn(
                          "flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-all",
                          sentiment === s ? c.cls : "border-white/10 text-muted-foreground hover:border-white/20"
                        )}
                      >
                        <Icon size={10} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Stage row */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Move to stage</p>
            <div className="flex flex-wrap gap-1">
              {allStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(lead.id, s); onClose(); }}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all",
                    lead.status === s
                      ? STATUS_BADGE_CLASS[s]
                      : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => { onDelete(lead.id); onClose(); }}
              className="flex items-center gap-1.5 text-[11px] text-red-400/70 hover:text-red-400 transition-colors mt-1"
            >
              <Trash2 size={11} />
              Delete lead
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
