import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lead, LeadSource, LeadStatus, SOURCE_LABELS } from "@/lib/data";
import { Phone, Linkedin, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
}

const SOURCE_OPTIONS: { value: LeadSource; label: string; icon: any; desc: string }[] = [
  { value: "cold_call", label: "Cold Call", icon: Phone, desc: "Outbound phone prospecting" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, desc: "Social / DM outreach" },
  { value: "networking", label: "Networking", icon: Users, desc: "Events, referrals, IRL" },
  { value: "instantly", label: "Instantly.ai", icon: Zap, desc: "Email campaign reply" },
];

const SOURCE_COLORS = {
  cold_call: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  linkedin: "border-blue-600/40 bg-blue-600/10 text-blue-300",
  networking: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  instantly: "border-primary/40 bg-primary/10 text-primary",
};

export default function AddLeadModal({ open, onClose, onAdd }: AddLeadModalProps) {
  const [source, setSource] = useState<LeadSource>("cold_call");
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "",
    title: "", linkedinUrl: "", notes: "", value: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.company) return;
    const lead: Lead = {
      id: crypto.randomUUID(),
      name: form.name,
      company: form.company,
      email: form.email,
      phone: form.phone || undefined,
      title: form.title || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      notes: form.notes || undefined,
      value: form.value ? parseInt(form.value) : undefined,
      source,
      status: "new",
      createdAt: new Date().toISOString().split("T")[0],
    };
    onAdd(lead);
    setForm({ name: "", company: "", email: "", phone: "", title: "", linkedinUrl: "", notes: "", value: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass border-[hsl(var(--glass-border-bright))] max-w-lg p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-white/8">
          <DialogTitle className="text-lg font-bold text-foreground">Add New Lead</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">Where did this lead come from?</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto scrollable">
          {/* Source selection */}
          <div className="grid grid-cols-2 gap-2">
            {SOURCE_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSource(value)}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-150",
                  source === value
                    ? SOURCE_COLORS[value]
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:bg-white/3"
                )}
              >
                <Icon size={15} className="flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[10px] opacity-70">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Marcus Chen"
                required
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Company *</label>
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Apex Solutions"
                required
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Job Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="VP of Sales"
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="m.chen@apex.com"
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 (415) 882-3941"
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              />
            </div>
            {source === "linkedin" && (
              <div className="col-span-2">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">LinkedIn URL</label>
                <Input
                  value={form.linkedinUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
                />
              </div>
            )}
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Deal Value ($)</label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="12000"
                className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Context, conversation notes, next steps..."
                rows={3}
                className="w-full glass border border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>
        </form>

        <div className="px-6 pb-6 pt-2 border-t border-white/8 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-semibold"
          >
            Add Lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
