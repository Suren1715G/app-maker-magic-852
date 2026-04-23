import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { stats, weeklySeries, leads, reviews } from "@/data/mock";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;

const quickPrompts = [
  "How many leads this week?",
  "What's my close rate?",
  "Summarize today",
];

export function ReceptionistWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi 👋 I'm your AI receptionist. Ask me anything about your business or how to use SGS." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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
      if (!resp.ok || !resp.body) { toast.error("Receptionist unavailable"); setBusy(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let soFar = "";
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
              soFar += c;
              setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, content: soFar } : m));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI receptionist"
        className={cn(
          "fixed bottom-24 right-4 z-40 h-13 w-13 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-accent text-primary-foreground",
          "flex items-center justify-center transition-all hover:scale-105",
          "h-12 w-12",
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute bottom-40 right-4 left-4 sm:left-auto sm:w-[360px] pointer-events-auto">
            <div className="glass-strong rounded-3xl border border-border/60 shadow-2xl flex flex-col max-h-[70vh] overflow-hidden animate-slide-up">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
                <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold leading-tight">AI Receptionist</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online · Always available
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                    {m.role === "assistant" && (
                      <span className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Bot className="h-3 w-3" />
                      </span>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border/60"
                      }`}
                    >
                      <div className="prose prose-xs prose-invert max-w-none [&>p]:my-0.5 [&>ul]:my-0.5 [&>ol]:my-0.5">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {messages.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {quickPrompts.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="border-t border-border/60 p-2 flex items-center gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="border-0 bg-transparent focus-visible:ring-0 h-9 text-sm"
                  disabled={busy}
                />
                <Button type="submit" size="icon" className="h-8 w-8 rounded-full shrink-0" disabled={busy || !input.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}