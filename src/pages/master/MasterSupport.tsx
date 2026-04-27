import { useEffect, useRef, useState } from "react";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Inbox, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Conv = {
  id: string;
  company_id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_admin: number;
  company_name?: string;
};

type Msg = {
  id: string;
  body: string;
  sender_role: "company" | "admin";
  created_at: string;
};

const MasterSupport = () => {
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = async () => {
    const { data: c } = await supabase
      .from("support_conversations")
      .select("id, company_id, subject, status, last_message_at, last_message_preview, unread_for_admin")
      .order("last_message_at", { ascending: false });
    if (!c) return;
    const ids = Array.from(new Set(c.map((x) => x.company_id)));
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", ids);
    const nameMap = new Map((companies ?? []).map((co) => [co.id, co.name]));
    setConvs(c.map((x) => ({ ...x, company_name: nameMap.get(x.company_id) })) as Conv[]);
    if (!activeId && c.length) setActiveId(c[0].id);
  };

  useEffect(() => {
    loadConvs();
    const ch = supabase
      .channel("master-support-convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, loadConvs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) { setMsgs([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("id, body, sender_role, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMsgs((data ?? []) as Msg[]);
      await supabase.from("support_conversations").update({ unread_for_admin: 0 }).eq("id", activeId);
    })();

    const ch = supabase
      .channel(`master-msgs-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        setMsgs((prev) => [...prev, payload.new as Msg]);
        if ((payload.new as Msg).sender_role === "company") {
          supabase.from("support_conversations").update({ unread_for_admin: 0 }).eq("id", activeId);
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, activeId]);

  const active = convs.find((c) => c.id === activeId);

  const reply = async () => {
    if (!draft.trim() || !active || !user || sending) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: active.id,
        company_id: active.company_id,
        sender_user_id: user.id,
        sender_role: "admin",
        body,
      });
    setSending(false);
    if (error) { toast.error(error.message); setDraft(body); }
  };

  const closeConv = async () => {
    if (!active) return;
    const next = active.status === "open" ? "closed" : "open";
    const { error } = await supabase.from("support_conversations").update({ status: next }).eq("id", active.id);
    if (error) toast.error(error.message);
    else { toast.success(next === "closed" ? "Marked resolved" : "Reopened"); loadConvs(); }
  };

  return (
    <MasterShell title="Support inbox" subtitle="Reply to customer conversations from one place.">
      <div className="grid md:grid-cols-[320px_1fr] gap-4 min-h-[60vh]">
        {/* Conversation list */}
        <aside className="glass rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <div className="font-display font-semibold text-sm">Conversations</div>
            <span className="ml-auto text-[10px] text-muted-foreground">{convs.length}</span>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-border/60">
            {convs.length === 0 && (
              <li className="px-4 py-6 text-xs text-muted-foreground text-center">No conversations yet.</li>
            )}
            {convs.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors",
                    activeId === c.id && "bg-primary/10"
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground truncate">{c.company_name ?? "Unknown company"}</span>
                    {c.unread_for_admin > 0 && (
                      <span className="ml-auto text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{c.unread_for_admin}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate">{c.subject || "Conversation"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.last_message_preview ?? "No messages yet"}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                    {c.status === "closed" && <span className="ml-2 text-success">· resolved</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Active conversation */}
        <section className="glass rounded-2xl flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation to reply.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{active.subject || "Conversation"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{active.company_name}</div>
                </div>
                <Button size="sm" variant="outline" onClick={closeConv}>
                  {active.status === "open" ? "Mark resolved" : "Reopen"}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {msgs.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">No messages yet.</div>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                      m.sender_role === "admin"
                        ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-md"
                        : "glass border border-border/60 rounded-bl-md"
                    )}>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className={cn("text-[10px] mt-1 opacity-70", m.sender_role === "admin" ? "text-primary-foreground" : "text-muted-foreground")}>
                        {m.sender_role === "company" ? "Customer · " : "You · "}
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); reply(); }}
                className="p-3 border-t border-border/60 flex items-center gap-2"
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply to customer…"
                  disabled={sending}
                />
                <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </MasterShell>
  );
};

export default MasterSupport;
