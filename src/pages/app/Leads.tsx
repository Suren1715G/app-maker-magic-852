import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { leads, type Lead, type LeadStatus } from "@/data/mock";
import { fmtMoney, fmtRel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Phone, MessageSquare, Globe, ChevronRight, X } from "lucide-react";

const cols: { id: LeadStatus; label: string; tone: string }[] = [
  { id: "new", label: "New", tone: "text-primary" },
  { id: "contacted", label: "Contacted", tone: "text-accent" },
  { id: "converted", label: "Converted", tone: "text-success" },
  { id: "lost", label: "Lost", tone: "text-muted-foreground" },
];

const sourceIcon = (s: Lead["source"]) =>
  s === "call" ? Phone : s === "sms" ? MessageSquare : Globe;

const Leads = () => {
  const [data, setData] = useState<Lead[]>(leads);
  const [active, setActive] = useState<Lead | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const move = (id: string, status: LeadStatus) =>
    setData((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

  const totalValue = data.filter((l) => l.status === "converted").reduce((a, b) => a + b.estValue, 0);
  const closeRate = Math.round(
    (data.filter((l) => l.status === "converted").length /
      Math.max(1, data.filter((l) => l.status !== "new").length)) *
      100
  );
  const counts = {
    new: data.filter((l) => l.status === "new").length,
    contacted: data.filter((l) => l.status === "contacted").length,
    converted: data.filter((l) => l.status === "converted").length,
    lost: data.filter((l) => l.status === "lost").length,
  };
  const leadsSummary =
    `Leads overview — pipeline ${data.length} (new ${counts.new}, contacted ${counts.contacted}, ` +
    `converted ${counts.converted}, lost ${counts.lost}). Close rate ${closeRate}%. ` +
    `Total won value ${fmtMoney(totalValue)}.`;

  return (
    <AppShell>
      <PageHeader title="Leads" subtitle="Every caller becomes a tracked opportunity." />
      <p className="sr-only" aria-label={leadsSummary}>{leadsSummary}</p>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div aria-label={`Pipeline total: ${data.length} leads.`}><Mini label="Pipeline" value={data.length} /></div>
        <div aria-label={`Close rate: ${closeRate} percent.`}><Mini label="Close rate" value={`${closeRate}%`} /></div>
        <div aria-label={`Total won value: ${fmtMoney(totalValue)}.`}><Mini label="Won" value={fmtMoney(totalValue)} /></div>
      </div>

      <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-3 no-scrollbar">
        {cols.map((c) => {
          const items = data.filter((l) => l.status === c.id);
          return (
            <div
              key={c.id}
              aria-label={`${c.label} column: ${items.length} lead${items.length === 1 ? "" : "s"}.`}
              className="min-w-[260px] w-[260px] glass rounded-2xl p-3"
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className={cn("font-display text-sm font-semibold", c.tone)}>{c.label}</h3>
                <span className="text-[10px] text-muted-foreground">{items.length}</span>
              </div>
              <ul className="space-y-2">
                {items.map((l) => {
                  const Icon = sourceIcon(l.source);
                  const leadLabel =
                    `Lead: ${l.name} (${l.phone}). Status ${l.status}. Source ${l.source}. ` +
                    `Estimated value ${fmtMoney(l.estValue)}. ` +
                    `Last contact ${new Date(l.lastContactAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}. ` +
                    `Notes: ${l.notes}`;
                  return (
                    <li key={l.id} aria-label={leadLabel}>
                      <button
                        onClick={() => { setActive(l); setDraftNote(l.notes); }}
                        className="w-full text-left rounded-xl p-3 bg-card hover:bg-secondary/50 transition-colors border border-border/40"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{l.name}</span>
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{l.phone}</div>
                        <div className="flex items-center justify-between mt-2 text-[11px]">
                          <span className="text-muted-foreground">{fmtRel(l.lastContactAt)}</span>
                          {l.estValue > 0 && <span className="text-primary font-semibold">{fmtMoney(l.estValue)}</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
                {items.length === 0 && (
                  <li className="text-center text-[11px] text-muted-foreground py-4">Empty</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="glass-strong rounded-3xl p-5 w-full max-w-md animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display text-xl font-semibold">{active.name}</h3>
                <p className="text-xs text-muted-foreground">{active.phone}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              <div className="bg-card rounded-xl p-2.5">
                <div className="text-muted-foreground">Source</div>
                <div className="font-medium capitalize">{active.source}</div>
              </div>
              <div className="bg-card rounded-xl p-2.5">
                <div className="text-muted-foreground">Est. value</div>
                <div className="font-medium">{fmtMoney(active.estValue)}</div>
              </div>
            </div>

            <label className="text-xs text-muted-foreground">Notes</label>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-1.5">Move to</div>
              <div className="grid grid-cols-4 gap-1.5">
                {cols.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { move(active.id, c.id); setActive({ ...active, status: c.id }); }}
                    className={cn(
                      "py-2 text-xs rounded-lg border transition-colors",
                      active.status === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${active.phone}`} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                <Phone className="h-4 w-4" /> Call
              </a>
              <a href={`sms:${active.phone}`} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border text-sm font-medium">
                <MessageSquare className="h-4 w-4" /> Text
              </a>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

const Mini = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="glass rounded-xl px-3 py-2.5">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display text-lg font-semibold mt-0.5">{value}</div>
  </div>
);

export default Leads;