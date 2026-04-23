import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { threads as mockThreads, type SmsThread } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { Flag, Send, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";

const Sms = () => {
  const isNew = useIsNewCustomer();
  const [threads, setThreads] = useState<SmsThread[]>(isNew ? [] : mockThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const active = threads.find((t) => t.id === activeId);

  const sendReply = () => {
    if (!active || !draft.trim()) return;
    const newMsg = { id: crypto.randomUUID(), from: "ai" as const, body: draft, at: new Date().toISOString() };
    setThreads((p) => p.map((t) => t.id === active.id ? { ...t, messages: [...t.messages, newMsg], unread: 0 } : t));
    setDraft("");
    toast.success("Reply sent (demo)");
  };

  const toggleFlag = (id: string) =>
    setThreads((p) => p.map((t) => t.id === id ? { ...t, flagged: !t.flagged } : t));

  const open = (id: string) => {
    setActiveId(id);
    setThreads((p) => p.map((t) => t.id === id ? { ...t, unread: 0 } : t));
  };

  if (active) {
    return (
      <AppShell>
        <header className="pt-4 pb-3 flex items-center gap-2">
          <button onClick={() => setActiveId(null)} className="text-muted-foreground hover:text-foreground -ml-1">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-semibold leading-none truncate">{active.customer}</h1>
            <p className="text-xs text-muted-foreground">{active.phone}</p>
          </div>
          <button
            onClick={() => toggleFlag(active.id)}
            className={cn("p-2 rounded-full", active.flagged ? "text-accent" : "text-muted-foreground")}
            aria-label="Flag"
          >
            <Flag className={cn("h-4 w-4", active.flagged && "fill-accent")} />
          </button>
        </header>

        <div className="space-y-2 mb-24 mt-2">
          {active.messages.map((m) => (
            <div key={m.id} className={cn("flex", m.from === "ai" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  m.from === "ai" ? "bg-primary text-primary-foreground rounded-br-sm" : "glass rounded-bl-sm"
                )}
              >
                <div>{m.body}</div>
                <div className={cn("text-[10px] mt-1", m.from === "ai" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {fmtRel(m.at)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); sendReply(); }}
          className="fixed bottom-[68px] left-0 right-0 z-30"
        >
          <div className="max-w-md mx-auto px-5">
            <div className="glass-strong rounded-full flex items-center gap-2 p-1.5 pl-4 border border-border/60">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a reply…"
                className="border-0 bg-transparent focus-visible:ring-0 px-0 h-9"
              />
              <Button type="submit" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={!draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Messages" subtitle="Two-way conversations the AI handled." />
      {(() => {
        const totalThreads = threads.length;
        const totalUnread = threads.reduce((a, t) => a + t.unread, 0);
        const totalMessages = threads.reduce((a, t) => a + t.messages.length, 0);
        const inboundMessages = threads.reduce(
          (a, t) => a + t.messages.filter((m) => m.from !== "ai").length,
          0,
        );
        const outboundMessages = totalMessages - inboundMessages;
        const flagged = threads.filter((t) => t.flagged).length;
        const summary =
          `Messages page overview (source of truth). ` +
          `Total conversation threads: ${totalThreads}. ` +
          `Total messages across all threads: ${totalMessages} ` +
          `(${inboundMessages} received from customers, ${outboundMessages} sent by the AI assistant). ` +
          `Currently unread messages: ${totalUnread}. ` +
          `Flagged threads: ${flagged}. ` +
          `Thread breakdown: ` +
          threads
            .map(
              (t) =>
                `${t.customer} has ${t.messages.length} message${t.messages.length === 1 ? "" : "s"} ` +
                `(${t.unread} unread${t.flagged ? ", flagged" : ""})`,
            )
            .join("; ") +
          ".";
        return <p className="sr-only" aria-label={summary}>{summary}</p>;
      })()}
      <ul className="space-y-2">
        {threads.map((t) => {
          const last = t.messages[t.messages.length - 1];
          const threadLabel =
            `Thread with ${t.customer} (${t.phone}). ` +
            `${t.messages.length} message${t.messages.length === 1 ? "" : "s"} total, ` +
            `${t.unread} unread${t.flagged ? ", flagged" : ""}. ` +
            `Last message ${last.from === "ai" ? "from you" : "from them"} ` +
            `${new Date(last.at).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}: ${last.body}`;
          return (
            <li key={t.id} aria-label={threadLabel}>
              <button
                onClick={() => open(t.id)}
                className="w-full text-left glass rounded-2xl p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold shrink-0">
                  {t.customer[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      {t.customer}
                      {t.flagged && <Flag className="h-3 w-3 fill-accent text-accent" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">{fmtRel(last.at)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {last.from === "ai" ? "You: " : ""}{last.body}
                  </div>
                </div>
                {t.unread > 0 && (
                  <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {t.unread}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
};

export default Sms;
