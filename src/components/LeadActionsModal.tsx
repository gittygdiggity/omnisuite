import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lead } from "@/lib/data";
import {
  Calculator, BookOpen, Globe, Calendar, MessageSquare, Sparkles,
  Copy, CheckCheck, ChevronRight, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadActionsModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

const CALENDAR_LINK = "https://cal.link/yourname/30min";

const ACTIONS = [
  {
    id: "omniconnex",
    label: "OmniConnex",
    icon: Globe,
    color: "text-primary bg-primary/10 border-primary/25",
    getMessage: (lead: Lead) =>
      `Hey ${lead.name.split(" ")[0]}! 👋\n\nI wanted to share OmniConnex with you — it's designed to help businesses like ${lead.company || "yours"} streamline outreach and connect with more clients effortlessly.\n\nCheck it out: https://omnibotai.io/omniconnex\n\nWould love to hear your thoughts!`,
  },
  {
    id: "omnicalculator",
    label: "OmniCalculator",
    icon: Calculator,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    getMessage: (lead: Lead) =>
      `Hi ${lead.name.split(" ")[0]}!\n\nHave you seen our OmniCalculator? It helps ${lead.company || "businesses"} instantly calculate ROI and potential savings from automating their workflows.\n\nTry it here: https://omnibotai.io/omnicalculator\n\nLet me know what numbers you get — I'd love to walk you through what's possible.`,
  },
  {
    id: "omnishakespeare",
    label: "OmniShakespeare",
    icon: BookOpen,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/25",
    getMessage: (lead: Lead) =>
      `Hey ${lead.name.split(" ")[0]}! ✍️\n\nThought you'd love OmniShakespeare — it's our AI writing assistant that crafts compelling copy, emails, and content for ${lead.company || "your business"} in seconds.\n\nCheck it out: https://omnibotai.io/omnishakespeare\n\nPerfect for sales outreach, marketing content, and more!`,
  },
  {
    id: "orientation",
    label: "OmniOrientation",
    icon: Bot,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    getMessage: (lead: Lead) =>
      `Hi ${lead.name.split(" ")[0]}!\n\nI'd love to walk you through everything OmniBot AI has to offer. Our orientation is a quick, personalized overview of how we can help ${lead.company || "your team"} grow.\n\nBook your orientation here: https://omnibotai.io/omniorientation\n\nTakes only 15 minutes and I'll customize it specifically for you.`,
  },
  {
    id: "calendar",
    label: "Book a Call",
    icon: Calendar,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    getMessage: (lead: Lead) =>
      `Hey ${lead.name.split(" ")[0]}! 📅\n\nI'd love to connect and learn more about ${lead.company || "what you're working on"} — even just a quick 15-minute chat can be really valuable.\n\nGrab a time that works for you: ${CALENDAR_LINK}\n\nLooking forward to speaking with you!`,
  },
  {
    id: "welcome",
    label: "Welcome Message",
    icon: Sparkles,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    getMessage: (lead: Lead) =>
      `Welcome ${lead.name.split(" ")[0]}! 🎉\n\nSo excited to have you connected with OmniBot AI! We're here to help ${lead.company || "your business"} automate, grow, and thrive with the power of AI.\n\nHere's what to expect next:\n• A quick onboarding call to understand your goals\n• Access to our full suite of AI tools\n• Dedicated support from our team\n\nLet's build something amazing together! 🚀`,
  },
  {
    id: "custom",
    label: "Custom Message",
    icon: MessageSquare,
    color: "text-slate-400 bg-slate-500/10 border-slate-500/25",
    getMessage: (_lead: Lead) => "",
  },
];

export default function LeadActionsModal({ lead, open, onClose }: LeadActionsModalProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const handleSelectAction = (actionId: string) => {
    const action = ACTIONS.find((a) => a.id === actionId)!;
    setSelectedAction(actionId);
    setMessage(action.getMessage(lead));
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleBack = () => {
    setSelectedAction(null);
    setMessage("");
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass border-[hsl(var(--glass-border-bright))] max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground leading-tight">
                {selectedAction ? "Draft Message" : "Take Action"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{lead.name} · {lead.email}</p>
            </div>
          </div>
        </div>

        {!selectedAction ? (
          /* Action picker */
          <div className="p-4 grid grid-cols-2 gap-2">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleSelectAction(action.id)}
                  className={cn(
                    "glass-card glass-hover flex items-center gap-3 px-4 py-3 text-left group transition-all duration-200 active:scale-[0.98]",
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border", action.color)}>
                    <Icon size={15} />
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1">{action.label}</span>
                  <ChevronRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        ) : (
          /* Message editor */
          <div className="p-5 space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="glass border-white/15 bg-white/4 text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/50 text-sm leading-relaxed resize-none"
              placeholder="Type your message..."
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="border border-white/15 text-muted-foreground hover:text-foreground h-9 text-sm"
              >
                ← Back
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleCopy}
                className={cn(
                  "h-9 text-sm font-semibold gap-2 transition-all duration-200",
                  copied
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
                )}
              >
                {copied ? (
                  <><CheckCheck size={14} />Copied!</>
                ) : (
                  <><Copy size={14} />Copy Message</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
