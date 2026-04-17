import { cn } from "@/lib/utils";
import { LOGO_DATA_URL } from "@/assets/logoData";
import {
  Users,
  FileText,
  Wrench,
  BarChart3,
  Settings,
  Building2,
} from "lucide-react";

export type TabId =
  | "pipeline"
  | "clients"
  | "personalize"
  | "builder"
  | "analytics"
  | "settings";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: "pipeline",    label: "Pipeline",    icon: Users },
  { id: "clients",     label: "Clients",     icon: Building2 },
  { id: "personalize", label: "Personalize", icon: FileText },
  { id: "builder",     label: "Builder",     icon: Wrench },
  { id: "analytics",   label: "Analytics",   icon: BarChart3 },
  { id: "settings",    label: "Settings",    icon: Settings },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <header className="flex items-center gap-1 px-4 py-2 border-b border-white/8 bg-background/80 backdrop-blur-xl flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-6">
        <div className="w-8 h-8 flex-shrink-0">
          <img src={LOGO_DATA_URL} alt="Logo" className="w-full h-full object-contain" style={{ mixBlendMode: "screen" }} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-foreground glow-text leading-none">OmniSuite</p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Sales Command Center</p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex items-center gap-0.5">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_16px_hsla(163,72%,42%,0.15)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <tab.icon
                size={15}
                className={cn("flex-shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")}
              />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
