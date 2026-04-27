import { AppShell, PageHeader } from "@/components/app/AppShell";
import { type CallTag } from "@/data/mock";
import { fmtDuration, fmtRel } from "@/lib/format";
import { Link } from "react-router-dom";
import { CheckCircle2, PhoneIncoming, PhoneMissed } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/app/StatCard";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationCtx } from "@/contexts/LocationContext";

type LiveCall = {
  id: string;
  caller: string | null;
  phone: string | null;
  startedAt: string;
  durationSec: number;
  status: "booked" | "answered" | "missed-followup";
  summary: string | null;
  tag: CallTag | null;
};

const filters = [
  { id: "all", label: "All" },
  { id: "booked", label: "Booked" },
  { id: "answered", label: "Answered" },
  { id: "missed-followup", label: "Follow-up" },
] as const;

const tagFilters: { id: "any" | CallTag; label: string }[] = [
  { id: "any", label: "Any tag" },
  { id: "lead", label: "Lead" },
  { id: "booked", label: "Booked" },
  { id: "follow-up", label: "Follow up" },
  { id: "spam", label: "Spam" },
];

const tagTone: Record<CallTag, string> = {
  lead: "bg-primary/15 text-primary",
  booked: "bg-success/15 text-success",
  "follow-up": "bg-accent/15 text-accent",
  spam: "bg-muted text-muted-foreground",
};

const ranges = [
  { id: "all", label: "All time", hours: Infinity },
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 days", hours: 24 * 7 },
] as const;

const Calls = () => {
  const isNew = useIsNewCustomer();
  const { companyId } = useAuth();
  const { active } = useLocationCtx();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setCalls([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      let q = supabase
        .from("calls")
        .select("id, caller, phone, started_at, duration_sec, status, summary, tag")
        .eq("company_id", companyId);
      if (active !== "all") q = q.eq("to_number", active.address);
      const { data } = await q
        .order("started_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      setCalls(
        (data ?? []).map((c) => ({
          id: c.id,
          caller: c.caller,
          phone: c.phone,
          startedAt: c.started_at,
          durationSec: c.duration_sec,
          status: (c.status as LiveCall["status"]) ?? "answered",
          summary: c.summary,
          tag: (c.tag as CallTag | null) ?? null,
        })),
      );
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`calls:${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `company_id=eq.${companyId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [companyId, active]);

  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [tag, setTag] = useState<"any" | CallTag>("any");
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("all");

  const list = useMemo(() => {
    const cutoff = ranges.find((r) => r.id === range)!.hours;
    const now = Date.now();
    return [...calls]
      .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
      .filter((c) => filter === "all" || c.status === filter)
      .filter((c) => tag === "any" || c.tag === tag)
      .filter((c) => cutoff === Infinity || (now - +new Date(c.startedAt)) / 36e5 <= cutoff);
  }, [filter, tag, range, calls]);

  const total = calls.length;
  const answered = calls.filter((c) => c.status !== "missed-followup").length;
  const missed = total - answered;
  const answerRate = Math.round((answered / Math.max(1, total)) * 100);
  const booked = calls.filter((c) => c.status === "booked").length;
  const followUp = calls.filter((c) => c.status === "missed-followup").length;
  const visibleCount = list.length;

  const summarySentence =
    `Calls overview — total ${total}, answered ${answered}, missed ${missed}, ` +
    `booked ${booked}, follow-up ${followUp}. Answer rate ${answerRate}%. ` +
    `Currently showing ${visibleCount} call${visibleCount === 1 ? "" : "s"} ` +
    `(filter: ${filter}, tag: ${tag}, range: ${range}).`;

  return (
    <AppShell>
      <PageHeader title="Calls" subtitle="Every conversation, captured." />
      {loading && companyId && (
        <p className="text-xs text-muted-foreground mb-2">Loading calls…</p>
      )}

      <p className="sr-only" aria-label={summarySentence}>{summarySentence}</p>

      <div data-tour="calls-stats" className="grid grid-cols-3 gap-2 mb-4">
        <div aria-label={`Answered calls: ${answered} (${answerRate}% answer rate).`}>
          <StatCard label="Answered" value={answered} hint={`${answerRate}%`} />
        </div>
        <div aria-label={`Missed calls: ${missed}. Auto SMS sent.`}>
          <StatCard label="Missed" value={missed} hint="Auto SMS sent" />
        </div>
        <div aria-label={`Total calls all time: ${total}.`}>
          <StatCard label="Total" value={total} hint="All time" />
        </div>
      </div>

      <div data-tour="calls-filters" className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 mb-3 no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary glow-primary"
                : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div data-tour="calls-tags" className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 mb-3 no-scrollbar">
        {tagFilters.map((t) => (
          <button
            key={t.id}
            onClick={() => setTag(t.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
              tag === t.id
                ? "bg-accent/20 text-accent border-accent/40"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1 shrink-0">
          {ranges.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium border",
                range === r.id
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-card text-muted-foreground border-border"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ul data-tour="calls-list" className="space-y-2">
        {list.map((c, idx) => {
          const Icon = c.status === "missed-followup" ? PhoneMissed : c.status === "booked" ? CheckCircle2 : PhoneIncoming;
          const tone =
            c.status === "booked" ? "text-success" : c.status === "missed-followup" ? "text-accent" : "text-primary";
          const callLabel =
            `Call ${idx + 1} of ${visibleCount}: ${c.caller} (${c.phone}). ` +
            `Status ${c.status}${c.tag ? `, tag ${c.tag}` : ""}. ` +
            `Started ${new Date(c.startedAt).toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}. Duration ${fmtDuration(c.durationSec)}. Summary: ${c.summary}`;
          return (
            <li key={c.id} aria-label={callLabel}>
              <Link
                to={`/calls/${c.id}`}
                className="glass rounded-2xl p-4 flex gap-3 hover:bg-secondary/40 transition-colors"
              >
                <div className={cn("mt-0.5", tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{c.caller}</div>
                    <div className="text-xs text-muted-foreground shrink-0">{fmtRel(c.startedAt)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.phone} · {fmtDuration(c.durationSec)}</div>
                  <div className="text-sm text-foreground/80 mt-2 line-clamp-2">{c.summary}</div>
                  {c.tag && (
                    <span className={cn("inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full", tagTone[c.tag])}>
                      {c.tag}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="text-center text-muted-foreground py-12 text-sm">
            {isNew || calls.length === 0
              ? "No calls yet. They'll appear here automatically as soon as your AI receptionist or Twilio number receives one."
              : "No calls in this view."}
          </li>
        )}
      </ul>
    </AppShell>
  );
};

export default Calls;
