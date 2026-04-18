import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import TabNav, { TabId } from "@/components/TabNav";
import Leads from "./pages/Leads";
import Clients from "./pages/Clients";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/SettingsPage";
import Builder from "./pages/Builder";

const queryClient = new QueryClient();

const App = () => {
  const [activeTab, setActiveTab] = useState<TabId>("pipeline");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <div className="flex flex-col h-screen w-screen overflow-hidden">
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="flex-1 overflow-hidden">
            {activeTab === "pipeline"    && <Leads />}
            {activeTab === "clients"     && <Clients />}
            {activeTab === "personalize" && <ComingSoon title="Personalize" desc="AI-powered copy personalization — upload a CSV, write example copy, and generate personalized outreach at scale." />}
            {activeTab === "builder"     && <Builder />}
            {activeTab === "analytics"   && <Analytics />}
            {activeTab === "settings"    && <SettingsPage />}
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="glass-card p-8 max-w-md text-center animate-fade-up">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚀</span>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
        <p className="text-xs text-muted-foreground/50 mt-4">Being integrated from the original standalone app</p>
      </div>
    </div>
  );
}

export default App;
