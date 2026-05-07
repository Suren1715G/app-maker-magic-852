import { useState, useRef, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Search, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; from: "customer" | "ai" | "owner"; body: string; at: string };
type Convo = {
  id: string;
  name: string;
  phone: string;
  aiMode: boolean;
  messages: Msg[];
};

const initialConvos: Convo[] = [
  {
    id: "1", name: "Marcus Johnson", phone: "+1 (415) 555-0142", aiMode: true,
    messages: [
      { id: "a", from: "customer", body: "Hey, how much for a full interior detail on an SUV?", at: "10:02 AM" },
      { id: "b", from: "ai", body: "Hi Marcus! Full interior on an SUV is $189. Want me to find a time this week?", at: "10:02 AM" },
      { id: "c", from: "customer", body: "Yeah Friday afternoon if possible", at: "10:04 AM" },
      { id: "d", from: "ai", body: "Friday at 2:00 PM is open. Should I book it?", at: "10:04 AM" },
      { id: "e", from: "customer", body: "Yes please", at: "10:05 AM" },
      { id: "f", from: "ai", body: "Booked! You'll get a confirmation text shortly. 🚗✨", at: "10:05 AM" },
    ],
  },
  {
    id: "2", name: "Sofia Reyes", phone: "+1 (628) 555-0193", aiMode: false,
    messages: [
      { id: "a", from: "customer", body: "Do you guys do ceramic coating?", at: "Yesterday" },
      { id: "b", from: "ai", body: "We do! Packages start at $599. Want details?", at: "Yesterday" },
      { id: "c", from: "customer", body: "Can the owner call me about it?", at: "Yesterday" },
      { id: "d", from: "owner", body: "Hey Sofia — this is Jake. Happy to chat. What's a good time?", at: "Yesterday" },
      { id: "e", from: "customer", body: "Tomorrow around 3?", at: "Yesterday" },
    ],
  },
  {
    id: "3", name: "Tyler Brooks", phone: "+1 (510) 555-0117", aiMode: true,
    messages: [
      { id: "a", from: "customer", body: "Whats your cheapest wash?", at: "Mon" },
      { id: "b", from: "ai", body: "Express exterior wash is $29. Takes about 20 min.", at: "Mon" },
      { id: "c", from: "customer", body: "Cool, can I just walk in?", at: "Mon" },
      { id: "d", from: "ai", body: "Yep — walk-ins welcome before 4pm weekdays.", at: "Mon" },
    ],
  },
  {
    id: "4", name: "Amanda Chen", phone: "+1 (415) 555-0188", aiMode: false,
    messages: [
      { id: "a", from: "customer", body: "I had a bad experience last time, scratches on my hood", at: "Sun" },
      { id: "b", from: "owner", body: "Amanda I'm so sorry. Can you come in tomorrow? I'll fix it personally, no charge.", at: "Sun" },
      { id: "c", from: "customer", body: "Ok thank you, that means a lot", at: "Sun" },
      { id: "d", from: "owner", body: "See you at 10am.", at: "Sun" },
    ],
  },
  {
    id: "5", name: "Devon Williams", phone: "+1 (408) 555-0166", aiMode: true,
    messages: [
      { id: "a", from: "customer", body: "Do you offer gift cards?", at: "Sat" },
      { id: "b", from: "ai", body: "Yes! Digital gift cards from $25-$500. Want me to send a link?", at: "Sat" },
      { id: "c", from: "customer", body: "Send the link", at: "Sat" },
      { id: "d", from: "ai", body: "Here you go: receptify.app/gift/jake-detail", at: "Sat" },
      { id: "e", from: "customer", body: "Perfect", at: "Sat" },
    ],
  },
];

export default function Inbox() {
  const [convos, setConvos] = useState<Convo[]>(initialConvos);
  const [activeId, setActiveId] = useState(convos[0].id);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = convos.find((c) => c.id === activeId)!;
  const filtered = convos.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, active.messages.length]);

  const toggleAi = (val: boolean) => {
    setConvos((cs) => cs.map((c) => (c.id === activeId ? { ...c, aiMode: val } : c)));
  };

  const send = () => {
    if (!draft.trim()) return;
    setConvos((cs) =>
      cs.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), from: "owner", body: draft, at: "Now" }] }
          : c
      )
    );
    setDraft("");
  };

  return (
    <AppShell>
      <PageHeader title="Inbox" subtitle="All conversations across SMS and chat" />
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-200px)]">
        {/* Left panel */}
        <div className="rounded-xl border border-border bg-card/40 backdrop-blur flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors flex gap-3 items-start",
                    activeId === c.id && "bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      c.aiMode ? "bg-emerald-500" : "bg-orange-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{last.at}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {last.body.slice(0, 40)}
                      {last.body.length > 40 ? "…" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="rounded-xl border border-border bg-card/40 backdrop-blur flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{active.name}</p>
              <p className="text-xs text-muted-foreground">{active.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[11px] font-medium",
                  active.aiMode ? "text-emerald-500" : "text-orange-500"
                )}
              >
                {active.aiMode ? "AI Mode" : "Manual Mode"}
              </span>
              <Switch
                checked={active.aiMode}
                onCheckedChange={toggleAi}
                className={cn(
                  active.aiMode
                    ? "data-[state=checked]:bg-emerald-500"
                    : "data-[state=unchecked]:bg-orange-500"
                )}
              />
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {active.messages.map((m) => {
              const isCustomer = m.from === "customer";
              return (
                <div key={m.id} className={cn("flex flex-col", isCustomer ? "items-start" : "items-end")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                      isCustomer
                        ? "bg-muted text-foreground rounded-bl-sm"
                        : "bg-primary text-primary-foreground rounded-br-sm"
                    )}
                  >
                    {m.body}
                  </div>
                  {!isCustomer && (
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {m.from === "ai" ? "AI" : "You"} · {m.at}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3">
            {active.aiMode ? (
              <div className="text-center text-xs text-muted-foreground py-2.5 rounded-md bg-muted/30">
                AI is handling this conversation
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type a message…"
                  className="flex-1"
                />
                <Button onClick={send} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}