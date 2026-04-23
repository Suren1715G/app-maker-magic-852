import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { bookings, type Booking } from "@/data/mock";
import { fmtTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, MoreVertical, CalendarX, UserX, CalendarClock, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type View = "month" | "week" | "day";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());

const Calendar = () => {
  const today = new Date();
  const [cursor, setCursor] = useState<Date>(startOfDay(today));
  const [view, setView] = useState<View>("month");
  const [selected, setSelected] = useState<Date>(startOfDay(today));
  const [items, setItems] = useState<Booking[]>(bookings);
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((b) => {
      const t = +new Date(b.startsAt);
      if (scope === "upcoming") return t >= now;
      if (scope === "past") return t < now;
      return true;
    });
  }, [items, scope]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filtered) {
      const k = startOfDay(new Date(b.startsAt)).toISOString();
      const arr = map.get(k) ?? [];
      arr.push(b);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }
    return map;
  }, [filtered]);

  const eventsFor = (d: Date) => eventsByDay.get(startOfDay(d).toISOString()) ?? [];

  const updateStatus = (id: string, status: NonNullable<Booking["status"]>) => {
    setItems((p) => p.map((b) => (b.id === id ? { ...b, status } : b)));
    toast.success(
      status === "cancelled" ? "Booking cancelled" :
      status === "no-show" ? "Marked as no-show" :
      status === "completed" ? "Marked completed" : "Updated"
    );
  };

  const reschedule = (b: Booking) => {
    const next = new Date(b.startsAt);
    next.setDate(next.getDate() + 1);
    setItems((p) => p.map((x) => (x.id === b.id ? { ...x, startsAt: next.toISOString() } : x)));
    toast.success(`Moved to ${next.toLocaleDateString()} ${fmtTime(next.toISOString())}`);
  };

  const navigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) {
      setCursor(startOfDay(today));
      setSelected(startOfDay(today));
      return;
    }
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    else if (view === "week") next.setDate(next.getDate() + 7 * dir);
    else next.setDate(next.getDate() + dir);
    setCursor(startOfDay(next));
  };

  const headerLabel = useMemo(() => {
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      const sameMonth = s.getMonth() === e.getMonth();
      return sameMonth
        ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
        : `${MONTHS[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return cursor.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }, [cursor, view]);

  return (
    <AppShell>
      <PageHeader
        title="Calendar"
        subtitle="Bookings synced to Google Calendar."
        right={
          <Badge variant="secondary" className="gap-1.5">
            <Link2 className="h-3 w-3 text-success" /> Google synced
          </Badge>
        }
      />

      <div className="flex gap-2 mb-3">
        {(["all", "upcoming", "past"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium capitalize border transition-colors",
              scope === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
        {(() => {
          const noShows = items.filter((b) => b.status === "no-show").length;
          return noShows > 0 ? (
            <span className="ml-auto text-[11px] text-muted-foreground self-center">
              {noShows} no-show{noShows > 1 ? "s" : ""} this period
            </span>
          ) : null;
        })()}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(0)}>Today</Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="font-display text-lg font-semibold ml-1">{headerLabel}</h2>
        </div>
        <div className="inline-flex rounded-xl border border-border p-1 bg-card">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <MonthView
          cursor={cursor}
          today={today}
          selected={selected}
          onSelectDay={setSelected}
          eventsFor={eventsFor}
        />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} today={today} eventsFor={eventsFor} onSelectDay={(d) => { setSelected(d); setView("day"); setCursor(d); }} />
      )}
      {view === "day" && <DayView day={cursor} events={eventsFor(cursor)} />}

      {view === "month" && (
        <DayDetail
          day={selected}
          events={eventsFor(selected)}
          onReschedule={reschedule}
          onStatus={updateStatus}
        />
      )}
    </AppShell>
  );
};

/* ---------- Month ---------- */
const MonthView = ({
  cursor, today, selected, onSelectDay, eventsFor,
}: {
  cursor: Date;
  today: Date;
  selected: Date;
  onSelectDay: (d: Date) => void;
  eventsFor: (d: Date) => Booking[];
}) => {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selected);
          const evs = eventsFor(d);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(d)}
              className={cn(
                "min-h-[88px] sm:min-h-[104px] border-b border-r border-border p-1.5 text-left flex flex-col gap-1 transition-colors",
                "hover:bg-accent/40 focus:outline-none focus:bg-accent/40",
                !inMonth && "bg-muted/10 text-muted-foreground/60",
                isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                (i + 1) % 7 === 0 && "border-r-0",
                i >= 35 && "border-b-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center justify-center text-xs font-semibold h-6 w-6 rounded-full",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  {d.getDate()}
                </span>
                {evs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{evs.length}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {evs.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "truncate text-[10px] leading-tight px-1.5 py-0.5 rounded",
                      e.smsConfirmed
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="font-semibold">{fmtTime(e.startsAt)}</span> {e.customer.split(" ")[0]}
                  </div>
                ))}
                {evs.length > 2 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">+{evs.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- Week ---------- */
const WeekView = ({
  cursor, today, eventsFor, onSelectDay,
}: {
  cursor: Date;
  today: Date;
  eventsFor: (d: Date) => Booking[];
  onSelectDay: (d: Date) => void;
}) => {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-border">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          const evs = eventsFor(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className="text-left p-3 min-h-[260px] hover:bg-accent/40 transition-colors flex flex-col gap-2"
            >
              <div className="flex flex-col items-start">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {WEEKDAYS[d.getDay()]}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center justify-center text-sm font-semibold h-7 w-7 rounded-full mt-1",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {evs.map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-[11px] leading-tight",
                      e.smsConfirmed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <div className="font-semibold">{fmtTime(e.startsAt)}</div>
                    <div className="truncate">{e.customer}</div>
                    <div className="truncate opacity-80">{e.service}</div>
                  </div>
                ))}
                {evs.length === 0 && (
                  <div className="text-[11px] text-muted-foreground/60">—</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- Day ---------- */
const DayView = ({ day, events }: { day: Date; events: Booking[] }) => {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am → 8pm
  return (
    <div className="glass rounded-2xl p-2 sm:p-4">
      <div className="relative">
        {hours.map((h) => (
          <div key={h} className="flex items-start border-t border-border first:border-t-0 min-h-[56px]">
            <div className="w-14 shrink-0 pt-1 text-[11px] text-muted-foreground text-right pr-2">
              {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
            </div>
            <div className="flex-1 relative py-1 pl-2">
              {events
                .filter((e) => new Date(e.startsAt).getHours() === h)
                .map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "rounded-xl px-3 py-2 mb-1",
                      e.smsConfirmed ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Clock className="h-3 w-3" />
                      {fmtTime(e.startsAt)} · {e.durationMin}m
                    </div>
                    <div className="font-medium text-sm">{e.customer}</div>
                    <div className="text-xs opacity-80">{e.service}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">No bookings on {day.toLocaleDateString()}.</div>
        )}
      </div>
    </div>
  );
};

/* ---------- Detail under month ---------- */
const DayDetail = ({
  day, events, onReschedule, onStatus,
}: {
  day: Date;
  events: Booking[];
  onReschedule: (b: Booking) => void;
  onStatus: (id: string, s: NonNullable<Booking["status"]>) => void;
}) => (
  <section className="mt-6">
    <div className="flex items-baseline gap-2 mb-3">
      <h3 className="font-display text-base font-semibold">
        {day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </h3>
      <span className="text-xs text-muted-foreground">
        {events.length === 0 ? "No bookings" : `${events.length} booking${events.length > 1 ? "s" : ""}`}
      </span>
    </div>
    {events.length > 0 && (
      <ul className="space-y-2">
        {events.map((b) => (
          <li key={b.id} className="glass rounded-2xl p-4 flex gap-4">
            <div className="flex flex-col items-center justify-center min-w-[72px] bg-primary/10 rounded-xl py-2">
              <div className="font-display text-lg font-semibold leading-none">{fmtTime(b.startsAt)}</div>
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {b.durationMin}m
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{b.customer}</div>
                {b.status === "cancelled" && <Badge variant="outline" className="text-[10px] py-0">Cancelled</Badge>}
                {b.status === "no-show" && <Badge className="bg-accent text-accent-foreground text-[10px] py-0">No-show</Badge>}
                {b.status === "completed" && <Badge className="bg-success text-success-foreground text-[10px] py-0">Done</Badge>}
              </div>
              <div className="text-sm text-muted-foreground truncate">{b.service}</div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {b.smsConfirmed ? (
                  <span className="text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> SMS confirmed
                  </span>
                ) : (
                  <span className="text-muted-foreground">SMS pending</span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 self-start">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onReschedule(b)}>
                  <CalendarClock className="h-4 w-4" /> Reschedule (+1d)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatus(b.id, "completed")}>
                  <CheckCircle2 className="h-4 w-4" /> Mark completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatus(b.id, "no-show")}>
                  <UserX className="h-4 w-4" /> Mark no-show
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onStatus(b.id, "cancelled")}
                  className="text-destructive focus:text-destructive"
                >
                  <CalendarX className="h-4 w-4" /> Cancel booking
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default Calendar;
