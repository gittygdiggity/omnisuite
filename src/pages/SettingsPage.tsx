import { useState, useEffect } from "react";
import {
  Settings,
  Key,
  Link2,
  CheckCircle2,
  Save,
  Bell,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  TestTube2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const TABS = [
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
];

// Storage helper — uses chrome.storage.sync if in extension, otherwise localStorage
function getStorage() {
  if (typeof chrome !== "undefined" && chrome?.storage?.sync) {
    return {
      get: (key: string): Promise<string> =>
        new Promise((resolve) =>
          chrome.storage.sync.get([key], (r: Record<string, string>) => resolve(r[key] || ""))
        ),
      set: (key: string, value: string): Promise<void> =>
        new Promise((resolve) =>
          chrome.storage.sync.set({ [key]: value }, () => resolve())
        ),
    };
  }
  return {
    get: async (key: string) => localStorage.getItem(`omnisuite_${key}`) || "",
    set: async (key: string, value: string) =>
      localStorage.setItem(`omnisuite_${key}`, value),
  };
}

const INTEGRATIONS = [
  {
    key: "instantly_api_key",
    label: "Instantly.ai",
    desc: "Sync leads from all sub-accounts and campaigns automatically",
    placeholder: "inst_xxxxxxxxxxxxxxxxxxxxxxxx",
    docs: "Instantly → Settings → API & Integrations",
    testAction: "sync_all_leads",
  },
  {
    key: "openai_api_key",
    label: "OpenAI",
    desc: "Powers live call coaching, copy personalization, and strategy generation",
    placeholder: "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
    docs: "platform.openai.com → API Keys",
  },
  {
    key: "fathom_api_key",
    label: "Fathom",
    desc: "Pull AI-generated call insights and summaries for your leads",
    placeholder: "fathom_api_key_xxxxxxxx",
    docs: "app.fathom.video → Settings → API",
  },
  {
    key: "brave_api_key",
    label: "Brave Search",
    desc: "Deep website research for personalized outreach copy",
    placeholder: "BSAxxxxxxxxxxxxxxxxxxxxxxxx",
    docs: "api.search.brave.com → API Keys",
  },
] as const;

type IntegrationKey = (typeof INTEGRATIONS)[number]["key"];

export default function SettingsPage() {
  const [tab, setTab] = useState("integrations");
  const [keys, setKeys] = useState<Record<IntegrationKey, string>>({
    instantly_api_key: "",
    openai_api_key: "",
    fathom_api_key: "",
    brave_api_key: "",
  });
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "ok" | "error" | null>>({});

  // Load keys on mount
  useEffect(() => {
    (async () => {
      const store = getStorage();
      const loaded: Record<string, string> = {};
      for (const integration of INTEGRATIONS) {
        loaded[integration.key] = await store.get(integration.key);
      }
      setKeys(loaded as Record<IntegrationKey, string>);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const store = getStorage();
    for (const integration of INTEGRATIONS) {
      await store.set(integration.key, keys[integration.key]);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async (key: string) => {
    setTesting(key);
    setTestResults((prev) => ({ ...prev, [key]: null }));
    try {
      if (key === "instantly_api_key") {
        // Test Instantly connection by triggering a sync
        const { error } = await supabase.functions.invoke("instantly-proxy", {
          body: { action: "sync_all_leads" },
        });
        setTestResults((prev) => ({
          ...prev,
          [key]: error ? "error" : "ok",
        }));
      } else {
        // Just validate key format
        setTestResults((prev) => ({
          ...prev,
          [key]: keys[key as IntegrationKey].length > 10 ? "ok" : "error",
        }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: "error" }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollable px-6 py-6 space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your integrations and API keys
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 animate-fade-up"
        style={{ animationDelay: "60ms" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150",
              tab === t.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "integrations" && (
        <div
          className="space-y-4 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          {INTEGRATIONS.map((integration) => (
            <div key={integration.key} className="glass-card p-5">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    keys[integration.key].length > 8
                      ? "bg-primary/15 border border-primary/30"
                      : "bg-white/5 border border-white/10"
                  )}
                >
                  <Key
                    size={15}
                    className={
                      keys[integration.key].length > 8
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {integration.label}
                    </p>
                    {keys[integration.key].length > 8 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/25 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 size={9} />
                        Connected
                      </span>
                    )}
                    {testResults[integration.key] === "ok" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 size={9} />
                        Verified
                      </span>
                    )}
                    {testResults[integration.key] === "error" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 border border-red-400/25 px-1.5 py-0.5 rounded-full">
                        <AlertCircle size={9} />
                        Failed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {integration.desc}
                  </p>
                  <div className="flex gap-2 items-center max-w-lg">
                    <div className="relative flex-1">
                      <Input
                        type={visible[integration.key] ? "text" : "password"}
                        value={keys[integration.key]}
                        onChange={(e) =>
                          setKeys((prev) => ({
                            ...prev,
                            [integration.key]: e.target.value,
                          }))
                        }
                        placeholder={integration.placeholder}
                        className="glass border-white/15 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/50 pr-10"
                      />
                      <button
                        onClick={() =>
                          setVisible((prev) => ({
                            ...prev,
                            [integration.key]: !prev[integration.key],
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {visible[integration.key] ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                    <Button
                      onClick={() => handleTest(integration.key)}
                      disabled={
                        testing === integration.key ||
                        keys[integration.key].length < 5
                      }
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {testing === integration.key ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <TestTube2 size={12} />
                      )}
                      Test
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Find it in: {integration.docs}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-semibold gap-2"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              {saved ? "Saved!" : saving ? "Saving…" : "Save All Keys"}
            </Button>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="glass-card p-6 max-w-lg animate-fade-up">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">O</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">OmniSuite Workspace</p>
              <p className="text-sm text-muted-foreground">
                Chrome Extension
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Display Name
              </label>
              <Input
                defaultValue="Your Name"
                className="glass border-white/15 bg-transparent text-foreground focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <Input
                type="email"
                defaultValue="you@example.com"
                className="glass border-white/15 bg-transparent text-foreground focus-visible:ring-primary/50"
              />
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 gap-2">
              <Save size={14} />
              Save Profile
            </Button>
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div className="glass-card p-6 max-w-lg animate-fade-up">
          <p className="text-sm text-muted-foreground">
            Notification preferences coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
