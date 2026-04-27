import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ChevronDown, Lightbulb, BookOpen, Send, MessageSquare, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

const faqs = [
  { q: "How does the AI know my services & pricing?", a: "You configure your services and prices in Settings. The AI references those when answering callers." },
  { q: "What happens on a missed call?", a: "If the AI can't answer or the caller hangs up, an automatic SMS follow-up is sent within 5 seconds." },
  { q: "Can I forward my existing number?", a: "Yes — we provide a forwarding number you set on your existing line. Calls reroute to the AI seamlessly." },
  { q: "Will customers know they're talking to AI?", a: "By default no, the voice is natural. You can enable a disclosure in Settings if your industry requires it." },
];

type Conversation = {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_company: number;
};

type Message = {
  id: string;
  body: string;
  sender_role: "company" | "admin";
  created_at: string;
};

const Support = () => {
  const { user, companyId } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  const [feature, setFeature] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [submittingFeature, setSubmittingFeature] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_conversations")
        .select("id, subject, status, last_message_at, last_message_preview, unread_for_company")
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false });
      if (cancelled) return;
      setConversations((data ?? []) as Conversation[]);
      if (data && data.length && !activeId) setActiveId(data[0].id);
    })();

    const ch = supabase
      .channel(`support-conv-company-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations", filter: `company_id=eq.${companyId}` }, async () => {
        const { data } = await supabase
          .from("support_conversations")
          .select("id, subject, status, last_message_at, last_message_preview, unread_for_company")
          .eq("company_id", companyId)
          .order("last_message_at", { ascending: false });
        setConversations((data ?? []) as Conversation[]);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [companyId]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("id, body, sender_role, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as Message[]);
      // Mark as read for company side
      await supabase
        .from("support_conversations")
        .update({ unread_for_company: 0 })
        .eq("id", activeId);
    })();

    const ch = supabase
      .channel(`support-msgs-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        // mark read when admin reply arrives while we're viewing
        if ((payload.new as Message).sender_role === "admin") {
          supabase.from("support_conversations").update({ unread_for_company: 0 }).eq("id", activeId);
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, activeId]);

  const startConversation = async () => {
    if (!companyId || !user) return;
    if (!newSubject.trim()) { toast.error("Add a short subject"); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from("support_conversations")
      .insert({ company_id: companyId, subject: newSubject.trim(), created_by: user.id })
      .select("id, subject, status, last_message_at, last_message_preview, unread_for_company")
      .single();
    setCreating(false);
    if (error || !data) { toast.error(error?.message ?? "Could not start conversation"); return; }
    setNewSubject("");
    setActiveId(data.id);
    toast.success("Conversation started — say hi 👋");
  };

  const send = async () => {
    if (!draft.trim() || !activeId || !companyId || !user || sending) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: activeId,
        company_id: companyId,
        sender_user_id: user.id,
        sender_role: "company",
        body,
      });
    setSending(false);
    if (error) { toast.error(error.message); setDraft(body); }
  };

  const active = conversations.find((c) => c.id === activeId);

  // Feature request submit with client-side rate limit (5 per minute → 2 min cooldown)
  const RATE_KEY = "sgs_feature_req_log";
  const submitFeature = async () => {
    if (!feature.trim() || !companyId || !user || submittingFeature) return;

    const now = Date.now();
    const log: number[] = JSON.parse(localStorage.getItem(RATE_KEY) || "[]");
    const recent = log.filter((t) => now - t < 60_000);
    const cooldownUntil = Number(localStorage.getItem(RATE_KEY + "_until") || 0);

    if (cooldownUntil && now < cooldownUntil) {
      const secs = Math.ceil((cooldownUntil - now) / 1000);
      toast.error(`Slow down — try again in ${secs}s`);
      return;
    }
    if (recent.length >= 5) {
      const until = now + 2 * 60_000;
      localStorage.setItem(RATE_KEY + "_until", String(until));
      toast.error("Too many requests — please wait 2 minutes.");
      return;
    }

    setSubmittingFeature(true);
    const { error } = await supabase
      .from("feature_requests")
      .insert({ company_id: companyId, submitted_by: user.id, body: feature.trim() });
    setSubmittingFeature(false);
    if (error) { toast.error(error.message); return; }

    recent.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(recent));
    toast.success("Sent! We read every one.");
    setFeature("");
  };

  return (
    <AppShell>
      <PageHeader title="Support" subtitle="Chat with our team — we typically reply within an hour." />

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => document.getElementById("support-chat")?.scrollIntoView({ behavior: "smooth" })}
          className="glass rounded-2xl p-4 text-left"
        >
          <MessageSquare className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-semibold">Chat with us</div>
          <div className="text-[11px] text-muted-foreground">Real human replies</div>
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

      {/* Live chat panel */}
      <div id="support-chat" className="glass rounded-2xl overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <div className="font-display text-sm font-semibold">Support inbox</div>
          </div>
          {conversations.length > 0 && (
            <select
              value={activeId ?? ""}
              onChange={(e) => setActiveId(e.target.value || null)}
              className="text-xs rounded-lg bg-input border border-border px-2 py-1.5 max-w-[55%] truncate"
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.subject || "Conversation")}{c.unread_for_company ? `  •  ${c.unread_for_company} new` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* New conversation row (always available) */}
        <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2 bg-secondary/20">
          <Input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Start a new conversation… (e.g. Need help forwarding my number)"
            className="h-9"
          />
          <Button onClick={startConversation} disabled={creating || !newSubject.trim()} size="sm">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>

        {/* Messages */}
        <div className="px-4 py-4 space-y-3 h-[60vh] min-h-[400px] overflow-y-auto">
          {(!activeId || messages.length === 0) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-3 text-sm glass border border-primary/10 space-y-2">
                <div className="font-medium">Hello 👋 How can we help you?</div>
                <div className="text-muted-foreground">
                  We usually get back to you within <span className="text-foreground font-medium">24 hours</span>.
                </div>
                <div className="text-muted-foreground text-xs pt-1 border-t border-border/50 space-y-0.5">
                  <div>📞 <a href="tel:+15088102288" className="text-foreground hover:text-primary">(508) 810-2288</a></div>
                  <div>✉️ <a href="mailto:sgsaireception@gmail.com" className="text-foreground hover:text-primary">sgsaireception@gmail.com</a></div>
                </div>
                {!activeId && (
                  <div className="text-[11px] text-muted-foreground pt-1">Start a new conversation above to begin chatting.</div>
                )}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === "company" ? "justify-end" : "justify-start"}`}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                m.sender_role === "company"
                  ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-md"
                  : "glass border border-primary/10 rounded-bl-md"
              )}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={cn("text-[10px] mt-1 opacity-70", m.sender_role === "company" ? "text-primary-foreground" : "text-muted-foreground")}>
                  {m.sender_role === "admin" ? "Support · " : ""}
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        {activeId && (
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="p-3 border-t border-border/60 flex items-center gap-2"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>

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
          disabled={!feature.trim() || submittingFeature}
          onClick={submitFeature}
        >
          Submit
        </Button>
      </div>
    </AppShell>
  );
};

export default Support;
