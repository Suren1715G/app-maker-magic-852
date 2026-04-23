import { AppShell, PageHeader } from "@/components/app/AppShell";
import { reviews } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { Star, ExternalLink, TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

const Reviews = () => {
  const avg = reviews.reduce((a, b) => a + b.rating, 0) / reviews.length;
  const trend = [4.2, 4.4, 4.5, 4.6, 4.7, 4.8, avg].map((v, i) => ({ i, v: Number(v.toFixed(2)) }));
  const breakdown = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));
  const reviewsSummary =
    `Reviews overview — total ${reviews.length}, average rating ${avg.toFixed(1)} stars. ` +
    `Breakdown: ${breakdown.map((b) => `${b.n} ${b.s}-star`).join(", ")}.`;

  return (
    <AppShell>
      <PageHeader title="Reviews" subtitle="The AI asks every happy customer to leave one." />
      <p className="sr-only" aria-label={reviewsSummary}>{reviewsSummary}</p>

      <div className="glass rounded-2xl p-5 mb-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Average rating</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display text-4xl font-semibold">{avg.toFixed(1)}</span>
              <span className="text-sm text-success flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +0.6 / 30d
              </span>
            </div>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-4 w-4 ${n <= Math.round(avg) ? "fill-accent text-accent" : "text-muted"}`} />
              ))}
            </div>
          </div>
          <div className="h-16 w-32">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <Tooltip cursor={false} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5 text-center">
          <Tile label="Total" value={reviews.length} />
          <Tile label="AI-prompted" value={`${reviews.length}/5`} />
          <Tile label="Conversion" value="64%" />
        </div>

        <a
          href="https://www.google.com/maps"
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Open Google Business <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <h2 className="font-display text-lg font-semibold mb-3">Recent reviews</h2>
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li
            key={r.id}
            aria-label={`Review by ${r.customer}, ${r.rating} out of 5 stars on ${r.source}, posted ${new Date(r.postedAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${r.body}`}
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-medium">{r.customer}</div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-accent text-accent" : "text-muted"}`} />
                ))}
              </div>
            </div>
            <p className="text-sm text-foreground/80">{r.body}</p>
            <div className="text-[11px] text-muted-foreground mt-2 capitalize">{r.source} · {fmtRel(r.postedAt)}</div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
};

const Tile = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="bg-card rounded-xl py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display text-base font-semibold">{value}</div>
  </div>
);

export default Reviews;