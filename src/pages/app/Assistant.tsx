import { useState, useRef, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { stats, weeklySeries, leads, reviews } from "@/data/mock";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;

const suggestions = [
  "How many leads did I get this week?",
  "What's my close rate?",
  "When are my best call hours?",
  "Summarize today.",
];

const Assistant = () => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi 👋 I'm your AI analyst. Ask me anything about your calls, bookings, leads, or reviews." },
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
      <PageHeader
        title="AI Assistant"
        subtitle="Ask your business anything."
        right={<Sparkles className="h-5 w-5 text-primary" />}
      />

      <div className="space-y-3 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5" />
              </span>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "glass"
              }`}
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
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="fixed bottom-[68px] left-0 right-0 z-30"
      >
        <div className="max-w-md mx-auto px-5">
          <div className="glass-strong rounded-full flex items-center gap-2 p-1.5 pl-4 border border-border/60">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your business…"
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-9"
              disabled={busy}
            />
            <Button type="submit" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={busy || !input.trim()}>
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