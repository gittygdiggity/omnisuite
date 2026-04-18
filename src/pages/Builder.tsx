import { useState, useEffect, useRef } from "react";
import {
  Send, Trash2, Globe, Calculator, BookOpen, Bot,
  ChevronDown, Cpu, Sparkles, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ── Storage helper (mirrors SettingsPage pattern) ─────────────────────────
function getStorage() {
  if (typeof chrome !== "undefined" && chrome?.storage?.sync) {
    return {
      get: (key: string): Promise<string> =>
        new Promise((resolve) =>
          chrome.storage.sync.get([key], (r: Record<string, string>) => resolve(r[key] || ""))
        ),
    };
  }
  return {
    get: async (key: string) => localStorage.getItem(`omnisuite_${key}`) || "",
  };
}

// ── Types ─────────────────────────────────────────────────────────────────
type Model = "claude" | "gpt";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

// ── Tool definitions ──────────────────────────────────────────────────────
const TOOLS = [
  {
    id: "omniconnex",
    label: "OmniConnex",
    icon: Globe,
    color: "text-primary border-primary/30 bg-primary/10",
    url: "https://omnibotai.io/omniconnex",
    desc: "Streamline outreach & connect with more clients",
  },
  {
    id: "omnishakespeare",
    label: "OmniShakespeare",
    icon: BookOpen,
    color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    url: "https://omnibotai.io/omnishakespeare",
    desc: "AI writing assistant for copy, emails & content",
  },
  {
    id: "omnicalculator",
    label: "OmniCalculator",
    icon: Calculator,
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    url: "https://omnibotai.io/omnicalculator",
    desc: "Calculate ROI & automation savings",
  },
  {
    id: "omniorientation",
    label: "OmniOrientation",
    icon: Bot,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    url: "https://omnibotai.io/omniorientation",
    desc: "Personalized 15-min OmniBot AI overview",
  },
] as const;

const SYSTEM_PROMPT = `You are OpenClaw, an expert AI sales assistant built into OmniSuite — the sales command center for OmniBot AI.

You help users with:
- Sales strategy and outreach copy
- Lead follow-up messaging
- Pitch refinement and objection handling
- Understanding and recommending OmniBot AI tools

Available OmniBot AI tools you can reference:
- OmniConnex (https://omnibotai.io/omniconnex): Streamlines outreach and client connection
- OmniShakespeare (https://omnibotai.io/omnishakespeare): AI writing assistant for compelling copy, emails, and content
- OmniCalculator (https://omnibotai.io/omnicalculator): Calculates ROI and automation savings
- OmniOrientation (https://omnibotai.io/omniorientation): Personalized 15-minute overview of OmniBot AI capabilities

When referencing tools, always include their URLs so the user can open them. Be concise, direct, and action-oriented. Format responses with markdown when helpful.`;

const MEMORY_KEY = "openclaw_messages";
const MODEL_KEY = "openclaw_model";

export default function Builder() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<Model>("claude");
  const [loading, setLoading] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted messages + model preference
  useEffect(() => {
    const saved = localStorage.getItem(MEMORY_KEY);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
    }
    const savedModel = localStorage.getItem(MODEL_KEY) as Model | null;
    if (savedModel === "gpt" || savedModel === "claude") setModel(savedModel);
  }, []);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const switchModel = (m: Model) => {
    setModel(m);
    localStorage.setItem(MODEL_KEY, m);
    setShowModelMenu(false);
  };

  const clearMemory = () => {
    setMessages([]);
    localStorage.removeItem(MEMORY_KEY);
  };

  const injectTool = (tool: typeof TOOLS[number]) => {
    setInput((prev) =>
      prev
        ? `${prev}\n\nTell me more about ${tool.label} (${tool.url})`
        : `Tell me about ${tool.label} and how I can use it for my outreach. (${tool.url})`
    );
    textareaRef.current?.focus();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const store = getStorage();
      const [openai_api_key, anthropic_api_key] = await Promise.all([
        store.get("openai_api_key"),
        store.get("anthropic_api_key"),
      ]);

      // Build messages for API (include system + full history)
      const apiMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...next.map(({ role, content }) => ({ role, content })),
      ];

      const { data, error: fnError } = await supabase.functions.invoke("openclaw-chat", {
        body: { messages: apiMessages, model, openai_api_key, anthropic_api_key },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const assistantMsg: Message = { role: "assistant", content: data.content, ts: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-background/60 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">OpenClaw</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">AI Sales Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-xs font-medium text-foreground"
            >
              {model === "claude" ? (
                <><Sparkles className="w-3.5 h-3.5 text-primary" /> Claude</>
              ) : (
                <><Bot className="w-3.5 h-3.5 text-emerald-400" /> GPT-4o</>
              )}
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showModelMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-card shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => switchModel("claude")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5 transition-colors text-left",
                    model === "claude" && "text-primary bg-primary/5"
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <div>
                    <p className="font-medium">Claude Sonnet</p>
                    <p className="text-muted-foreground text-[10px]">Anthropic</p>
                  </div>
                </button>
                <button
                  onClick={() => switchModel("gpt")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5 transition-colors text-left",
                    model === "gpt" && "text-emerald-400 bg-emerald-500/5"
                  )}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <div>
                    <p className="font-medium">GPT-4o</p>
                    <p className="text-muted-foreground text-[10px]">OpenAI</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearMemory}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Tool chips ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-background/40 flex-shrink-0 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider whitespace-nowrap mr-1">Tools</span>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => injectTool(tool)}
              title={tool.desc}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-all hover:scale-105",
                tool.color
              )}
            >
              <Icon className="w-3 h-3" />
              {tool.label}
            </button>
          );
        })}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">OpenClaw is ready</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Ask me anything about sales strategy, outreach copy, or click a tool above to get started.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {["Write a follow-up email", "Help me pitch OmniConnex", "Improve my cold outreach"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" && "justify-end")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Cpu className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary/20 border border-primary/30 text-foreground rounded-tr-sm"
                  : "bg-card border border-white/8 text-foreground rounded-tl-sm"
              )}
            >
              <MessageContent content={msg.content} />
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-3.5 h-3.5 text-primary animate-pulse" />
            </div>
            <div className="bg-card border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-sm text-center">
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/8 bg-background/60 backdrop-blur">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask OpenClaw anything… (Enter to send, Shift+Enter for newline)"
            className="min-h-[44px] max-h-36 resize-none bg-card border-white/10 text-sm focus-visible:ring-primary/50 placeholder:text-muted-foreground/40"
            rows={1}
          />
          <Button
            onClick={send}
            disabled={!input.trim() || loading}
            className="h-11 w-11 p-0 bg-primary hover:bg-primary/80 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
          Using {model === "claude" ? "Claude Sonnet (Anthropic)" : "GPT-4o (OpenAI)"} · Memory persists across sessions
        </p>
      </div>
    </div>
  );
}

// Renders message content — converts markdown links to clickable anchors
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.match(/^https?:\/\//) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </p>
  );
}
