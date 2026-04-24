import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { stats, weeklySeries, leads, reviews } from "@/data/mock";
import { ReceptionistOrb } from "@/components/app/ReceptionistOrb";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;

const suggestions = [
  { label: "Leads this week", q: "How many leads did I get this week?" },
  { label: "Close rate", q: "What's my close rate?" },
  { label: "Best call hours", q: "When are my best call hours?" },
  { label: "Summarize today", q: "Summarize today." },
];

const Assistant = () => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "At your service. I'm **Jarvis** — your AI analyst. Ask me anything about your calls, bookings, leads, or reviews." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    const context = JSON.stringify({
      stats,
      weekly: weeklySeries,
      leadsCount: leads.length,
      converted: leads.filter((l) => l.status === "converted").length,
      avgRating: reviews.reduce((a, b) => a + b.rating, 0) / reviews.length,
    });

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (resp.status === 429) { toast.error("Rate limit — try again in a sec."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setBusy(false); return; }
      if (!resp.ok || !resp.body) { toast.error("Assistant failed"); setBusy(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let so_far = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              so_far += c;
              setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, content: so_far } : m));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {/* Hero */}
      <header className="pt-4 pb-5 flex items-center gap-4">
        <div className="relative shrink-0">
          <span className="absolute inset-0 -m-2 rounded-full bg-gradient-hero opacity-30 blur-xl animate-pulse-glow pointer-events-none" />
          <ReceptionistOrb speaking={busy} connected size={64} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold leading-none">
              <span className="prism-text">Jarvis</span>
            </h1>
            <span className="glass rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Online
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Your in-app intelligence layer.</p>
        </div>
      </header>

      <div className="space-y-3 mb-4 pb-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 animate-fade-in ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center shrink-0 shadow-[0_0_12px_hsl(var(--primary)/0.5)]">
                <Zap className="h-3.5 w-3.5" />
              </span>
            )}
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)]"
                  : "max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm glass border border-primary/10"
              }
            >
              <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            Try asking
          </div>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.q}
                onClick={() => send(s.q)}
                className="text-xs px-3 py-2.5 rounded-xl glass border border-primary/10 text-foreground/90 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="fixed bottom-[68px] left-0 right-0 z-30"
      >
        <div className="max-w-md mx-auto px-5">
          <div className="glass-strong rounded-full flex items-center gap-2 p-1.5 pl-4 border border-primary/20 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.4)]">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Jarvis anything…"
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-9"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0 bg-gradient-to-br from-primary to-accent hover:opacity-90"
              disabled={busy || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
      <div className="h-16" />
    </AppShell>
  );
};

export default Assistant;