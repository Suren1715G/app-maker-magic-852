import { AppShell } from "@/components/app/AppShell";
import { StatCard } from "@/components/app/StatCard";
import { calls as mockCalls, bookings as mockBookings, stats as mockStats, leads as mockLeads, notifications as mockNotifications } from "@/data/mock";
import { fmtDay, fmtMoney, fmtRel, fmtTime } from "@/lib/format";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Phone, Sparkles, Clock, Users } from "lucide-react";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationCtx } from "@/contexts/LocationContext";

type LiveCall = {
  id: string;
  caller: string | null;
  startedAt: string;
  status: string;
  summary: string | null;
};

const Home = () => {
  const isNew = useIsNewCustomer();
  const { companyId } = useAuth();
  const { active } = useLocationCtx();
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);

  useEffect(() => {
    if (!companyId) {
      setLiveCalls([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      let q = supabase
        .from("calls")
        .select("id, caller, started_at, status, summary")
        .eq("company_id", companyId);
      // When a single location is selected, scope to that line only.
      // "all" shows the combined dashboard across every line.
      if (active !== "all") q = q.eq("to_number", active.address);
      const { data } = await q
        .order("started_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setLiveCalls(
        (data ?? []).map((c) => ({
          id: c.id,
          caller: c.caller,
          startedAt: c.started_at,
          status: c.status,
          summary: c.summary,
        })),
      );
    };
    load();

    const channel = supabase
      .channel(`home-calls:${companyId}`)
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

  const hasLive = liveCalls.length > 0;
  const calls = hasLive ? [] : isNew ? [] : mockCalls;
  const bookings = isNew ? [] : mockBookings;
  const leads = isNew ? [] : mockLeads;
  const notifications = isNew ? [] : mockNotifications;
  const baseStats = isNew || hasLive
    ? { callsToday: 0, bookingsToday: 0, conversionRate: 0, smsSent: 0, minutesSaved: 0, revenueBookedToday: 0 }
    : mockStats;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const callsToday = liveCalls.filter((c) => new Date(c.startedAt) >= startOfToday).length;

  const stats = {
    ...baseStats,
    callsToday: hasLive ? callsToday : baseStats.callsToday,
  };

  const recent = hasLive
    ? liveCalls.slice(0, 3).map((c) => ({
        id: c.id,
        caller: c.caller ?? "Unknown caller",
        startedAt: c.startedAt,
        status: c.status,
        summary: c.summary ?? "",
      }))
    : [...calls]
        .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
        .slice(0, 3);
  const next = [...bookings].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  const newLeads = leads.filter((l) => l.status === "new" || l.status === "contacted").length;
  const unread = notifications.filter((n) => !n.read).length;
  const hoursSaved = (stats.minutesSaved / 60).toFixed(1);

  const homeSummary =
    `Home dashboard — calls today ${stats.callsToday}, bookings today ${stats.bookingsToday}, ` +
    `revenue booked today ${fmtMoney(stats.revenueBookedToday)}, conversion rate ${Math.round(stats.conversionRate * 100)}%, ` +
    `new leads in pipeline ${newLeads}, SMS sent ${stats.smsSent}, hours saved this week ${hoursSaved}, ` +
    `unread notifications ${unread}.` +
    (next
      ? ` Next booking: ${next.customer}, ${next.service}, ${new Date(next.startsAt).toLocaleString(undefined, {
          weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
        })}, ${next.durationMin} minutes.`
      : " No upcoming bookings.");

  return (
    <AppShell>
      <p className="sr-only" aria-label={homeSummary}>{homeSummary}</p>

      <header className="pt-4 pb-6">
        <span className="text-muted-foreground text-sm block">Welcome back</span>
        <h1 className="font-display text-4xl font-semibold leading-none mt-1">
          <span className="prism-text">SGS</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Your AI receptionist is on the line.</p>
      </header>

      <div data-tour="home-status" className="glass rounded-2xl p-4 flex items-center gap-3 mb-6">
        <span className="relative flex h-3 w-3">
          <span className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium">Answering calls now</div>
          <div className="text-xs text-muted-foreground">{stats.callsToday} calls today · avg {isNew ? "—" : "1m 38s"}</div>
        </div>
        {unread > 0 && (
          <Link to="/notifications" className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary font-semibold">
            {unread} new
          </Link>
        )}
      </div>

      <Link
        to="/analytics"
        data-tour="home-hours-saved"
        className="glass rounded-2xl p-4 mb-6 flex items-center gap-3 gradient-border hover:bg-secondary/40 transition-colors"
      >
        <span className="h-11 w-11 rounded-full bg-primary/20 text-primary flex items-center justify-center">
          <Clock className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">
            {isNew ? "No hours saved yet" : `Your AI saved you ${hoursSaved} hours this week`}
          </div>
          <div className="text-xs text-muted-foreground">
            {isNew ? "Stats will appear once calls come in" : `≈ ${fmtMoney(Number(hoursSaved) * 35)} in receptionist time`}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>

      <div data-tour="home-stats" className="grid grid-cols-2 gap-3 mb-8">
        <StatCard label="Calls today" value={stats.callsToday} hint={isNew ? "—" : `${Math.round(stats.conversionRate * 100)}% booked`} icon={<Phone className="h-4 w-4" />} accent />
        <StatCard label="Bookings" value={stats.bookingsToday} hint={isNew ? "—" : `${fmtMoney(stats.revenueBookedToday)} booked`} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="New leads" value={newLeads} hint={isNew ? "—" : "In your pipeline"} icon={<Users className="h-4 w-4" />} />
        <StatCard label="SMS sent" value={stats.smsSent} hint={isNew ? "—" : "Confirmations & replies"} icon={<Sparkles className="h-4 w-4" />} />
      </div>

      {next ? (
        <section data-tour="home-next-booking" className="mb-8">
          <SectionTitle title="Next booking" to="/calendar" />
          <Link
            to="/calendar"
            className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex flex-col items-center justify-center bg-primary/15 rounded-xl px-3 py-2 min-w-[72px]">
              <div className="text-[10px] uppercase tracking-wider text-primary">{fmtDay(next.startsAt)}</div>
              <div className="font-display text-lg font-semibold">{fmtTime(next.startsAt)}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{next.customer}</div>
              <div className="text-sm text-muted-foreground truncate">
                {next.service} · {next.durationMin}m
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        </section>
      ) : (
        <section data-tour="home-next-booking" className="mb-8">
          <SectionTitle title="Next booking" to="/calendar" />
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No upcoming bookings.
          </div>
        </section>
      )}

      <section data-tour="home-recent-calls">
        <SectionTitle title="Recent calls" to="/calls" />
        {recent.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No calls yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((c) => (
              <li
                key={c.id}
                aria-label={`Recent call: ${c.caller}, status ${c.status}, started ${new Date(c.startedAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}. Summary: ${c.summary}`}
              >
                <Link
                  to={`/calls/${c.id}`}
                  className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full shrink-0 " +
                      (c.status === "booked"
                        ? "bg-success"
                        : c.status === "missed-followup"
                        ? "bg-accent"
                        : "bg-primary")
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.caller}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.summary}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{fmtRel(c.startedAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
};

const SectionTitle = ({ title, to }: { title: string; to: string }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-display text-lg font-semibold">{title}</h2>
    <Link to={to} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
      View all <ArrowRight className="h-3 w-3" />
    </Link>
  </div>
);

export default Home;
