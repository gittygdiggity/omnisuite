export type LeadSource = "cold_call" | "linkedin" | "networking" | "instantly";
export type LeadStatus = "new" | "booked" | "qualified" | "proposal" | "won" | "lost";
export type LeadSentiment = "interested" | "follow_up" | "opportunity" | "negative" | "neutral";

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  title?: string;
  source: LeadSource;
  status: LeadStatus;
  sentiment: LeadSentiment;
  notes?: string;
  linkedinUrl?: string;
  createdAt: string;
  lastContacted?: string;
  value?: number;
  tags?: string[];
  clientId?: string;
  subAccount?: string;
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  cold_call: "Cold Call",
  linkedin: "LinkedIn",
  networking: "Networking",
  instantly: "Instantly.ai",
};

export const SOURCE_COLORS: Record<LeadSource, string> = {
  cold_call: "hsl(var(--source-cold))",
  linkedin: "hsl(var(--source-linkedin))",
  networking: "hsl(var(--source-networking))",
  instantly: "hsl(var(--source-instantly))",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  booked: "Booked",
  qualified: "Qualified",
  proposal: "Proposal Sent",
  won: "Won",
  lost: "Lost",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "hsl(var(--status-new))",
  booked: "hsl(var(--status-contacted))",
  qualified: "hsl(var(--status-qualified))",
  proposal: "hsl(var(--status-proposal))",
  won: "hsl(var(--status-won))",
  lost: "hsl(var(--status-lost))",
};

export const STATUS_COLUMN_ORDER: LeadStatus[] = [
  "new", "booked", "qualified", "proposal", "won", "lost",
];
