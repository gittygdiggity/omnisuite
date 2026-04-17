import { useState } from "react";
import {
  Mail, Plus, Play, Pause, Trash2, Clock, CheckCircle2,
  ArrowRight, Calendar, Key, Zap, MessageSquare, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AutomationStep {
  id: string;
  delay: string;
  subject: string;
  preview: string;
  type: "email" | "task" | "wait";
}

interface Automation {
  id: string;
  name: string;
  trigger: string;
  active: boolean;
  sent: number;
  opened: number;
  replied: number;
  steps: AutomationStep[];
}

const MOCK_AUTOMATIONS: Automation[] = [
  {
    id: "a1",
    name: "Post-Demo Follow-Up",
    trigger: "Lead books demo on calendar",
    active: true,
    sent: 47,
    opened: 31,
    replied: 12,
    steps: [
      { id: "s1", delay: "Immediate", subject: "Great talking with you!", preview: "Thanks for taking the time to chat today. As promised...", type: "email" },
      { id: "s2", delay: "2 days later", subject: "Quick follow-up + resources", preview: "I wanted to share the case studies we discussed...", type: "email" },
      { id: "s3", delay: "5 days later", subject: "Any questions?", preview: "Just checking in to see if you had a chance to review...", type: "email" },
      { id: "s4", delay: "10 days later", subject: "Last touch", preview: "I'll leave this in your court. Let me know if...", type: "email" },
    ],
  },
  {
    id: "a2",
    name: "Discovery Call Booked",
    trigger: "Lead books discovery call",
    active: true,
    sent: 23,
    opened: 18,
    replied: 7,
    steps: [
      { id: "s5", delay: "Immediate", subject: "Confirmed: Discovery Call", preview: "Your discovery call is confirmed for...", type: "email" },
      { id: "s6", delay: "1 day before", subject: "Reminder: Call tomorrow", preview: "Just a friendly reminder that we have a call scheduled...", type: "email" },
      { id: "s7", delay: "1 hour before", subject: "See you in 1 hour!", preview: "Our call starts in 1 hour. Here's the link...", type: "email" },
    ],
  },
  {
    id: "a3",
    name: "No-Show Re-Engagement",
    trigger: "Lead misses scheduled call",
    active: false,
    sent: 8,
    opened: 5,
    replied: 2,
    steps: [
      { id: "s8", delay: "1 hour after", subject: "Missed your call — want to reschedule?", preview: "Hey, looks like we missed each other...", type: "email" },
      { id: "s9", delay: "3 days later", subject: "Still interested?", preview: "I know things get busy. Happy to find a better time...", type: "email" },
    ],
  },
];

function StepNode({ step, index, isLast }: { step: AutomationStep; index: number; isLast: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-primary">{index + 1}</span>
        </div>
        {!isLast && <div className="w-px flex-1 bg-primary/20 my-1 min-h-[20px]" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={11} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{step.delay}</span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-0.5">{step.subject}</p>
          <p className="text-[11px] text-muted-foreground truncate">{step.preview}</p>
        </div>
      </div>
    </div>
  );
}

export default function Automations() {
  const [automations, setAutomations] = useState(MOCK_AUTOMATIONS);
  const [selected, setSelected] = useState<string>(MOCK_AUTOMATIONS[0].id);
  const [gmailKey, setGmailKey] = useState("");
  const [connected, setConnected] = useState(false);

  const selectedAuto = automations.find(a => a.id === selected);

  const toggleActive = (id: string) =>
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between flex-shrink-0 animate-fade-up">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Email Automations</h1>
          <p className="text-xs text-muted-foreground">Auto-follow-up sequences triggered by calendar bookings</p>
        </div>
        <div className="flex items-center gap-3">
          {connected && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={11} />
              Gmail Connected
            </span>
          )}
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-sm font-semibold gap-1.5">
            <Plus size={14} />
            New Automation
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: list */}
        <div className="w-72 border-r border-white/8 p-4 overflow-y-auto scrollable flex-shrink-0 space-y-2">
          {/* Gmail connection */}
          {!connected && (
            <div className="glass-card p-3 border-primary/20 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Key size={13} className="text-primary" />
                <p className="text-xs font-semibold text-foreground">Connect Gmail</p>
              </div>
              <Input
                type="password"
                value={gmailKey}
                onChange={(e) => setGmailKey(e.target.value)}
                placeholder="Gmail API key..."
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50 h-7 text-xs mb-2"
              />
              <Button
                onClick={() => gmailKey.length > 5 && setConnected(true)}
                size="sm"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs"
              >
                Connect Gmail
              </Button>
            </div>
          )}

          {automations.map((auto) => (
            <button
              key={auto.id}
              onClick={() => setSelected(auto.id)}
              className={cn(
                "w-full text-left glass-card p-3 transition-all duration-150",
                selected === auto.id
                  ? "border-primary/40 bg-primary/8"
                  : "glass-hover"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold text-foreground leading-tight flex-1">{auto.name}</p>
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 mt-0.5",
                  auto.active ? "bg-primary animate-pulse" : "bg-muted-foreground"
                )} />
              </div>
              <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                <Calendar size={9} />
                {auto.trigger}
              </p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-muted-foreground">{auto.sent} sent</span>
                <span className="text-primary">{auto.replied} replied</span>
                <span className="text-foreground/60">{auto.steps.length} steps</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right: detail */}
        {selectedAuto && (
          <div className="flex-1 overflow-y-auto scrollable p-5 animate-fade-in">
            {/* Auto header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-base font-bold text-foreground">{selectedAuto.name}</h2>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border",
                    selectedAuto.active
                      ? "text-primary border-primary/30 bg-primary/10"
                      : "text-muted-foreground border-white/20 bg-white/5"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", selectedAuto.active ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                    {selectedAuto.active ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Zap size={12} className="text-primary" />
                  Trigger: {selectedAuto.trigger}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => toggleActive(selectedAuto.id)}
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs glass glass-hover border-white/15"
                >
                  {selectedAuto.active ? <Pause size={12} /> : <Play size={12} />}
                  {selectedAuto.active ? "Pause" : "Activate"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <Settings2 size={14} />
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Sent", value: selectedAuto.sent, color: "text-foreground" },
                { label: "Opened", value: selectedAuto.opened, color: "text-amber-400", pct: `${Math.round((selectedAuto.opened / selectedAuto.sent) * 100)}%` },
                { label: "Replied", value: selectedAuto.replied, color: "text-primary", pct: `${Math.round((selectedAuto.replied / selectedAuto.sent) * 100)}%` },
              ].map((s) => (
                <div key={s.label} className="glass-card p-3 text-center">
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                  {s.pct && <p className="text-[10px] text-muted-foreground">{s.pct} rate</p>}
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Sequence steps */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageSquare size={14} className="text-primary" />
                Email Sequence ({selectedAuto.steps.length} steps)
              </h3>
              <div className="pl-1">
                {selectedAuto.steps.map((step, i) => (
                  <StepNode
                    key={step.id}
                    step={step}
                    index={i}
                    isLast={i === selectedAuto.steps.length - 1}
                  />
                ))}
              </div>
              <button className="flex items-center gap-2 text-[11px] text-primary hover:text-primary/80 mt-1 ml-10 transition-colors">
                <Plus size={12} />
                Add step
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
