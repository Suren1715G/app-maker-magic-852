import { useState, useRef, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ChevronDown, MessageSquare, Lightbulb, BookOpen, Send, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

const quickPrompts = [
  "How do I forward my number?",
  "How do I set up my services?",
  "How does the AI greet customers?",
  "How do I change my plan?",
];

const faqs = [
  { q: "How does the AI know my services & pricing?", a: "You configure your services and prices in Settings. The AI references those when answering callers." },
  { q: "What happens on a missed call?", a: "If the AI can't answer or the caller hangs up, an automatic SMS follow-up is sent within 5 seconds." },
  { q: "Can I forward my existing number?", a: "Yes — we provide a forwarding number you set on your existing line. Calls reroute to the AI seamlessly." },
  { q: "Will customers know they're talking to AI?", a: "By default no, the voice is natural. You can enable a disclosure in Settings if your industry requires it." },
  { q: "How do reviews get auto-requested?", a: "After a successful booking is completed, the AI texts the customer with a one-tap link to your Google review page." },
];

const Support = () => {
  const [open, setOpen] = useState<number | null>(0);
  const [feature, setFeature] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi 👋 I'm **SGS Support**. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, chatOpen]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (resp.status === 429) { toast.error("Too many requests — try again shortly."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setBusy(false); return; }
      if (!resp.ok || !resp.body) { toast.error("Chat failed"); setBusy(false); return; }

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
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Support" subtitle="We're one tap away." />

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => setChatOpen(true)}
          className="glass rounded-2xl p-4 text-left"
        >
          <MessageSquare className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-semibold">Chat with us</div>
          <div className="text-[11px] text-muted-foreground">Instant AI replies</div>
        </button>
        <button
          onClick={() => toast.info("Onboarding tour coming soon")}
          className="glass rounded-2xl p-4 text-left"
        >
          <BookOpen className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-semibold">Get started tour</div>
          <div className="text-[11px] text-muted-foreground">5 min walk-through</div>
        </button>
      </div>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center">
                <Zap className="h-3.5 w-3.5" />
              </span>
              Support Chat
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center shrink-0">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm bg-gradient-to-br from-primary to-accent text-primary-foreground"
                      : "max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm glass border border-primary/10"
                  }
                >
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {messages.length <= 1 && (
              <div className="pt-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" /> Try asking
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs px-3 py-2.5 rounded-xl glass border border-primary/10 text-foreground/90 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="p-3 border-t border-border/60"
          >
            <div className="glass-strong rounded-full flex items-center gap-2 p-1.5 pl-4 border border-primary/20">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question…"
                className="border-0 bg-transparent focus-visible:ring-0 px-0 h-9"
                disabled={busy}
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 rounded-full shrink-0"
                disabled={busy || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground text-center mt-2">
              Need a human? Email <span className="text-foreground">support@sgs.ai</span>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <h2 className="font-display text-lg font-semibold mb-3">FAQ</h2>
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-6">
        {faqs.map((f, i) => (
          <li key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-medium">{f.q}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-muted-foreground">{f.a}</div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-accent" /> Request a feature
      </h2>
      <div className="glass rounded-2xl p-4 mb-12">
        <textarea
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          placeholder="What would make SGS perfect for you?"
          rows={3}
          className="w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          className="w-full mt-3"
          disabled={!feature.trim()}
          onClick={() => { toast.success("Sent! We read every one."); setFeature(""); }}
        >
          Submit
        </Button>
      </div>
    </AppShell>
  );
};

export default Support;