import { Lead, SOURCE_LABELS, LeadSentiment } from "@/lib/data";
import { Phone, Linkedin, Users, Zap, Building2, Mail, ExternalLink, TrendingUp, Trash2, DollarSign, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onSentimentChange: (id: string, sentiment: LeadSentiment) => void;
}

const SOURCE_ICONS = {
  cold_call: Phone,
  linkedin: Linkedin,
  networking: Users,
  instantly: Zap,
};

const SOURCE_BADGE_CLASS = {
  cold_call: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  linkedin: "bg-blue-600/15 text-blue-300 border-blue-600/30",
  networking: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  instantly: "bg-primary/15 text-primary border-primary/30",
};

// Per-sentiment card wrapper styles
const SENTIMENT_CARD_CLASS: Record<LeadSentiment, string> = {
  // follow_up: pulsing emerald — needs action NOW
  follow_up: [
    "border border-emerald-400/60",
    "shadow-[0_0_14px_2px_rgba(52,211,153,0.25)]",
    "bg-emerald-500/5",
  ].join(" "),
  // interested: green glow but no pulse — positive, not urgent
  interested: [
    "border border-emerald-400/30",
    "bg-emerald-500/4",
  ].join(" "),
  opportunity: [
    "border border-amber-400/50",
    "shadow-[0_0_12px_1px_rgba(251,191,36,0.18)]",
    "bg-amber-500/4",
  ].join(" "),
  negative: "border border-red-500/30 bg-red-500/3",
  neutral: "",
};

function getSourceIcon(lead: Lead): React.ElementType {
  if (lead.sentiment === "follow_up") return Bell;
  if (lead.sentiment === "interested") return DollarSign;
  if (lead.sentiment === "opportunity") return TrendingUp;
  return SOURCE_ICONS[lead.source];
}

function getSourceBadgeClass(lead: Lead): string {
  if (lead.sentiment === "follow_up")
    return "bg-emerald-500/25 text-emerald-200 border-emerald-400/50";
  if (lead.sentiment === "interested")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (lead.sentiment === "opportunity")
    return "bg-amber-500/15 text-amber-300 border-amber-400/35";
  return SOURCE_BADGE_CLASS[lead.source];
}

function getSentimentLabel(lead: Lead): string {
  if (lead.sentiment === "follow_up") return "Follow Up";
  if (lead.sentiment === "interested") return "Interested";
  if (lead.sentiment === "opportunity") return "Opportunity";
  return SOURCE_LABELS[lead.source];
}

export default function LeadCard({ lead, onClick, onDelete }: Omit<LeadCardProps, "onSentimentChange"> & { onSentimentChange?: LeadCardProps["onSentimentChange"] }) {
  const sentiment: LeadSentiment = lead.sentiment ?? "neutral";
  const SourceIcon = getSourceIcon(lead);
  const isGreen = sentiment === "interested" || sentiment === "follow_up";

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("lead_id", lead.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "glass-card group relative transition-all duration-200 active:scale-[0.98] cursor-grab active:cursor-grabbing rounded-xl",
        SENTIMENT_CARD_CLASS[sentiment]
      )}
    >
      {/* Pulsing dot — ONLY for "follow_up" (needs action) */}
      {sentiment === "follow_up" && (
        <span className="absolute top-2.5 left-2.5 flex h-2.5 w-2.5 z-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
      )}

      {/* Clickable body */}
      <div onClick={() => onClick(lead)} className="p-3.5 cursor-pointer">
        {/* Header */}
        <div className={cn("flex items-start gap-2.5 mb-2.5", sentiment === "follow_up" && "pl-4")}>
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            isGreen
              ? "bg-emerald-500/20 border border-emerald-400/40"
              : sentiment === "opportunity"
              ? "bg-amber-500/15 border border-amber-400/30"
              : "bg-primary/15 border border-primary/30"
          )}>
            <span className={cn(
              "text-xs font-bold",
              isGreen ? "text-emerald-300" : sentiment === "opportunity" ? "text-amber-300" : "text-primary"
            )}>
              {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-semibold truncate leading-tight",
              isGreen ? "text-emerald-100" : "text-foreground"
            )}>{lead.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 size={10} className="text-muted-foreground flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground truncate">{lead.company || "—"}</p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className={cn("flex flex-wrap gap-1 mb-2.5", sentiment === "follow_up" && "pl-4")}>
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border", getSourceBadgeClass(lead))}>
            <SourceIcon size={9} />
            {getSentimentLabel(lead)}
          </span>
          {lead.title && (
            <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/8 px-1.5 py-0.5 rounded truncate max-w-[110px]">
              {lead.title}
            </span>
          )}
          {lead.subAccount && (
            <span className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded truncate max-w-[90px]">
              {lead.subAccount}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className={cn("flex items-center justify-between pt-2 border-t", isGreen ? "border-emerald-500/20" : "border-white/6", sentiment === "follow_up" && "pl-4")}>
          <div className="flex items-center gap-2">
            {lead.email && <Mail size={11} className="text-muted-foreground" />}
            {lead.linkedinUrl && <ExternalLink size={11} className="text-muted-foreground" />}
            {(lead.lastContacted || lead.createdAt) && (
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(lead.lastContacted ?? lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          {lead.value && (
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary">${lead.value.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
          title="Delete lead"
          className="w-6 h-6 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/25 transition-colors"
        >
          <Trash2 size={10} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}
