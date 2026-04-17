import { NavLink, useLocation } from "react-router-dom";
import { LOGO_DATA_URL } from "@/assets/logoData";
import {
  Users,
  Calendar,
  Settings,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="glass-sidebar w-64 h-full flex flex-col py-6 px-3 flex-shrink-0 animate-slide-left">
      {/* Logo + Brand */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-10 h-10 flex-shrink-0">
          <img src={LOGO_DATA_URL} alt="Logo" className="w-full h-full object-contain" style={{ mixBlendMode: "screen" }} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-foreground glow-text">Outreach CRM</p>
          <p className="text-[11px] text-muted-foreground">Pro Workspace</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_16px_hsla(163,72%,42%,0.2)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon
                size={16}
                className={cn(
                  "flex-shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="flex-1">{label}</span>
              {active && (
                <ChevronRight size={12} className="text-primary opacity-70" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom user info */}
      <div className="glass-card px-3 py-3 mt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">Your Workspace</p>
            <p className="text-[10px] text-muted-foreground truncate">Pro Plan</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
    </aside>
  );
}
