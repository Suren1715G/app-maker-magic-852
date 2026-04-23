import { AppShell, PageHeader } from "@/components/app/AppShell";
import { calls } from "@/data/mock";
import { fmtDuration, fmtRel } from "@/lib/format";
import { Link } from "react-router-dom";
import { CheckCircle2, PhoneIncoming, PhoneMissed } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const filters = [
  { id: "all", label: "All" },
  { id: "booked", label: "Booked" },
  { id: "answered", label: "Answered" },
  { id: "missed-followup", label: "Follow-up" },
] as const;

const Calls = () => {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const list = [...calls]
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
    .filter((c) => filter === "all" || c.status === filter);

  return (
    <AppShell>
      <PageHeader title="Calls" subtitle="Every conversation, captured." />

      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 mb-3 no-scrollbar">
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

      <ul className="space-y-2">
        {list.map((c) => {
          const Icon = c.status === "missed-followup" ? PhoneMissed : c.status === "booked" ? CheckCircle2 : PhoneIncoming;
          const tone =
            c.status === "booked" ? "text-success" : c.status === "missed-followup" ? "text-accent" : "text-primary";
          return (
            <li key={c.id}>
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
                </div>
              </Link>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="text-center text-muted-foreground py-12 text-sm">No calls in this view.</li>
        )}
      </ul>
    </AppShell>
  );
};

export default Calls;
