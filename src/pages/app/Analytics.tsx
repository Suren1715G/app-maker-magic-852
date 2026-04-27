import { AppShell, PageHeader } from "@/components/app/AppShell";
import { weeklySeries as mockWeeklySeries, heatmap as mockHeatmap, stats as mockStats } from "@/data/mock";
import { fmtMoney } from "@/lib/format";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ranges = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "mtd", label: "MTD" },
] as const;

const Analytics = () => {
  const isNew = useIsNewCustomer();
  const { companyId } = useAuth();
  const [range, setRange] = useState<(typeof ranges)[number]["id"]>("7d");
  const [realCalls, setRealCalls] = useState<{ started_at: string; duration_sec: number | null }[]>([]);

  const rangeStart = useMemo(() => {
    const d = new Date();
    if (range === "7d") d.setDate(d.getDate() - 6);
    else if (range === "30d") d.setDate(d.getDate() - 29);
    else d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [range]);

  useEffect(() => {
    if (!isNew || !companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("calls")
        .select("started_at,duration_sec")
        .eq("company_id", companyId)
        .gte("started_at", rangeStart.toISOString())
        .order("started_at", { ascending: true })
        .limit(1000);
      if (!cancelled) setRealCalls(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [isNew, companyId, rangeStart]);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const { weeklySeries, heatmap, stats } = useMemo(() => {
    if (!isNew) {
      return { weeklySeries: mockWeeklySeries, heatmap: mockHeatmap, stats: mockStats };
    }
    // Build last-7-day series ending today (always 7 buckets for the chart)
    const now = new Date();
    const days: { day: string; date: Date; calls: number; bookings: number; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ day: dayLabels[d.getDay()], date: d, calls: 0, bookings: 0, revenue: 0 });
    }
    const heat = dayLabels.map((d) => ({ day: d, hours: Array(24).fill(0) as number[] }));
    let totalSec = 0;
    for (const c of realCalls) {
      const t = new Date(c.started_at);
      totalSec += c.duration_sec ?? 0;
      // heatmap by weekday/hour
      heat[t.getDay()].hours[t.getHours()] += 1;
      // weekly series
      for (const bucket of days) {
        const next = new Date(bucket.date); next.setDate(next.getDate() + 1);
        if (t >= bucket.date && t < next) { bucket.calls += 1; break; }
      }
    }
    return {
      weeklySeries: days.map(({ day, calls, bookings, revenue }) => ({ day, calls, bookings, revenue })),
      heatmap: heat,
      stats: { ...mockStats, minutesSaved: Math.round(totalSec / 60) },
    };
  }, [isNew, realCalls]);

  const totalCalls = weeklySeries.reduce((a, b) => a + b.calls, 0);
  const totalBookings = weeklySeries.reduce((a, b) => a + b.bookings, 0);
  const totalRevenue = weeklySeries.reduce((a, b) => a + b.revenue, 0);
  const conv = totalCalls > 0 ? Math.round((totalBookings / totalCalls) * 100) : 0;

  const exportPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>SGS Performance Report</title>
      <style>
        body{font-family:-apple-system,sans-serif;padding:40px;color:#111;max-width:720px;margin:auto}
        h1{font-size:28px;margin:0 0 4px}
        .sub{color:#666;margin-bottom:24px}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
        .card{border:1px solid #eee;border-radius:12px;padding:16px}
        .v{font-size:24px;font-weight:600}
        .l{font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.04em}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:12px}
      </style></head><body>
        <h1>SGS Performance Report</h1>
        <div class="sub">${new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})} · Last 7 days</div>
        <div class="grid">
          <div class="card"><div class="l">Total calls</div><div class="v">${totalCalls}</div></div>
          <div class="card"><div class="l">Bookings</div><div class="v">${totalBookings}</div></div>
          <div class="card"><div class="l">Conversion</div><div class="v">${conv}%</div></div>
          <div class="card"><div class="l">Revenue booked</div><div class="v">${fmtMoney(totalRevenue)}</div></div>
        </div>
        <h2>Daily breakdown</h2>
        <table><tr><th>Day</th><th>Calls</th><th>Bookings</th><th>Revenue</th></tr>
        ${weeklySeries.map(d=>`<tr><td>${d.day}</td><td>${d.calls}</td><td>${d.bookings}</td><td>${fmtMoney(d.revenue)}</td></tr>`).join("")}
        </table>
        <p style="margin-top:32px;color:#999;font-size:11px">Generated by SGS · AI Receptionist</p>
        <script>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  const max = Math.max(1, ...heatmap.flatMap((d) => d.hours));

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        subtitle="The numbers behind the AI."
        right={
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        }
      />

      <div data-tour="analytics-range" className="flex gap-2 mb-5">
        {ranges.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border",
              range === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div data-tour="analytics-stats" className="grid grid-cols-2 gap-3 mb-5">
        <Stat label="Calls" value={totalCalls} delta="+18% MoM" />
        <Stat label="Bookings" value={totalBookings} delta={totalCalls > 0 ? `${conv}% conv.` : "—"} />
        <Stat label="Revenue" value={fmtMoney(totalRevenue)} delta="+22% MoM" />
        <Stat label="Uptime" value="99.8%" delta="this month" />
      </div>

      <Card title="Call volume">
        <div data-tour="analytics-volume" className="h-44">
          <ResponsiveContainer>
            <AreaChart data={weeklySeries} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gC)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Bookings & revenue">
        <div data-tour="analytics-bookings" className="h-44">
          <ResponsiveContainer>
            <BarChart data={weeklySeries} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Best call hours">
        <div data-tour="analytics-heatmap" className="overflow-x-auto -mx-1 px-1 no-scrollbar">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[36px_repeat(24,minmax(14px,1fr))] gap-px text-[9px] text-muted-foreground mb-1">
              <div></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center">{h % 3 === 0 ? h : ""}</div>
              ))}
            </div>
            {heatmap.map((row) => (
              <div key={row.day} className="grid grid-cols-[36px_repeat(24,minmax(14px,1fr))] gap-px mb-px">
                <div className="text-[10px] text-muted-foreground self-center">{row.day}</div>
                {row.hours.map((v, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-[3px]"
                    style={{
                      background: v === 0
                        ? "hsl(var(--muted) / 0.4)"
                        : `hsl(var(--primary) / ${0.15 + (v / max) * 0.75})`,
                    }}
                    title={`${row.day} ${i}:00 — ${v} calls`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-success/20 text-success flex items-center justify-center">
          <TrendingUp className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold">You're outperforming similar businesses</div>
          <div className="text-xs text-muted-foreground">
            Average for cleaning services: 18 calls/wk. You: {totalCalls}. 🔥
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 mb-12 flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold">{stats.minutesSaved} minutes saved this week</div>
          <div className="text-xs text-muted-foreground">≈ 2.4 hours of front-desk work the AI handled.</div>
        </div>
      </div>
    </AppShell>
  );
};

const Stat = ({ label, value, delta }: { label: string; value: React.ReactNode; delta: string }) => (
  <div className="glass rounded-2xl p-3.5">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    <div className="text-[10px] text-success mt-0.5">{delta}</div>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass rounded-2xl p-4 mb-5">
    <h2 className="font-display text-sm font-semibold mb-3">{title}</h2>
    {children}
  </section>
);

export default Analytics;