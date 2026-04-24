import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { referrals as mockReferrals } from "@/data/mock";
import { Copy, Link2, Send, Sparkles, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";
import { useAuth } from "@/contexts/AuthContext";

const BASE_PRICE = 250;
const TIERS = [
  { count: 1, off: 50, label: "$50 OFF" },
  { count: 2, off: 100, label: "$100 OFF" },
  { count: 3, off: 175, label: "$175 OFF" },
  { count: 4, off: 250, label: "FREE MONTH" },
] as const;

function priceFor(count: number) {
  const tier = [...TIERS].reverse().find((t) => count >= t.count);
  const off = tier ? tier.off : 0;
  return { off, price: Math.max(0, BASE_PRICE - off) };
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-center font-mono text-[11px] tracking-[0.25em] text-primary/70 mb-2">
    // {children}
  </div>
);

const SectionHeading = ({ plain, accent }: { plain: string; accent: string }) => (
  <h2 className="text-center font-display font-bold text-3xl md:text-5xl leading-[1.05] mb-8">
    {plain} <span className="prism-text">{accent}</span>
  </h2>
);

const Referrals = () => {
  const isNew = useIsNewCustomer();
  const { user } = useAuth();
  const referrals = isNew ? [] : mockReferrals;
  const earned = referrals.filter((r) => r.status === "joined").length;

  const refCode = useMemo(() => {
    const seed = user?.id?.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "SGSDEMO1";
    return seed;
  }, [user?.id]);
  const link = `${window.location.origin}/auth?mode=signup&ref=${refCode}`;
  const message = `Hey, I use this AI receptionist that answers all my calls and books appointments automatically. Costs $250/month and pays for itself easily. Check it out: ${link}`;

  const [copied, setCopied] = useState<"link" | "msg" | null>(null);
  const copyTo = async (text: string, kind: "link" | "msg", label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1800);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Try SGS", url: link }); return; } catch {}
    }
    copyTo(link, "link", "Link");
  };

  // Calculator
  const [picked, setPicked] = useState(earned || 1);
  const { off: pickedOff, price: pickedPrice } = priceFor(picked);
  const toGoal = Math.max(0, 4 - earned);

  return (
    <AppShell>
      <PageHeader title="Referrals" subtitle="Give one month free, get one back." />

      {/* HERO STATUS */}
      <section className="relative mb-14">
        <div className="glass-strong rounded-3xl p-6 md:p-8 text-center overflow-hidden gradient-border">
          <div className="font-mono text-[11px] tracking-[0.25em] text-primary/70 mb-3">
            // YOUR STATUS
          </div>
          <div className="font-display text-5xl md:text-7xl font-bold leading-none">
            <span className="prism-text">{earned}</span>
            <span className="text-foreground/80"> / 4</span>
          </div>
          <div className="text-sm text-muted-foreground mt-3">
            {earned >= 4
              ? "You've maxed out — next month is on us."
              : `${toGoal} more for a free month.`}
          </div>
          <div className="mt-5 h-2 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (earned / 4) * 100)}%`,
                background: "var(--gradient-hero)",
              }}
            />
          </div>
        </div>
      </section>

      {/* TIER BREAKDOWN */}
      <section className="mb-16">
        <SectionLabel>TIER BREAKDOWN</SectionLabel>
        <SectionHeading plain="Every signup." accent="Bigger discount." />
        <ul className="space-y-3">
          {TIERS.map((t) => {
            const reached = earned >= t.count;
            return (
              <li
                key={t.count}
                className={cn(
                  "glass rounded-2xl p-4 md:p-5 flex items-center gap-4 transition-all",
                  reached && "shadow-[0_0_40px_-10px_hsl(280_90%_65%/0.6)] border-primary/40"
                )}
              >
                <div
                  className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center font-display text-xl md:text-2xl font-bold text-white shrink-0 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)]"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  {t.count}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                    {t.count} REFERRAL{t.count === 1 ? "" : "S"}
                  </div>
                  <div className={cn(
                    "font-display font-bold text-lg md:text-xl",
                    t.count === 4 && "prism-text"
                  )}>
                    {t.label}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground line-through mr-1.5">${BASE_PRICE}</span>
                  <span className={cn(
                    "font-display font-bold text-2xl md:text-3xl",
                    t.count === 4 && "prism-text"
                  )}>
                    ${BASE_PRICE - t.off}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">/mo</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* SAVINGS CALCULATOR */}
      <section className="mb-16">
        <SectionLabel>SAVINGS CALCULATOR</SectionLabel>
        <SectionHeading plain="Drag to see" accent="your bill." />
        <div className="glass-strong rounded-3xl p-6 md:p-8">
          <div className="text-center font-mono text-[11px] tracking-[0.25em] text-muted-foreground mb-3">
            REFERRALS
          </div>
          <div className="flex items-center justify-center gap-6 md:gap-8 mb-6">
            <button
              type="button"
              onClick={() => setPicked((p) => Math.max(0, p - 1))}
              className="h-12 w-12 rounded-full glass flex items-center justify-center text-2xl text-foreground/80 hover:text-foreground hover:scale-105 transition-transform"
              aria-label="Decrease"
            >
              −
            </button>
            <div className="font-display text-7xl md:text-8xl font-bold prism-text leading-none w-24 md:w-28 text-center">
              {picked}
            </div>
            <button
              type="button"
              onClick={() => setPicked((p) => Math.min(4, p + 1))}
              className="h-12 w-12 rounded-full glass flex items-center justify-center text-2xl text-foreground/80 hover:text-foreground hover:scale-105 transition-transform"
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={picked}
            onChange={(e) => setPicked(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="text-center mt-7">
            <div className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground mb-2">
              YOUR BILL NEXT MONTH
            </div>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-lg text-muted-foreground line-through">${BASE_PRICE}</span>
              <span className="font-display text-6xl md:text-7xl font-bold">${pickedPrice}</span>
            </div>
            {pickedOff > 0 && (
              <div className="mt-3 text-sm text-accent">
                {picked >= 4 ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Sparkles className="h-3.5 w-3.5" /> FREE MONTH
                  </span>
                ) : (
                  <>You save ${pickedOff} this month</>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mb-16">
        <SectionLabel>HOW IT WORKS</SectionLabel>
        <SectionHeading plain="Three steps." accent="Zero effort." />
        <div className="grid md:grid-cols-3 gap-3 md:gap-4">
          {[
            { icon: Link2, title: "Copy your link", body: "Every account gets a unique referral URL. One tap to copy from your dashboard." },
            { icon: Send, title: "Send it to detailers", body: "Drop it in a DM, text, group chat, or email. Anyone running an auto detail shop." },
            { icon: Sparkles, title: "Discount applies automatically", body: "When they become a paying customer, the discount lands on your next bill — no claim forms." },
          ].map((s, i) => (
            <div key={i} className="glass rounded-2xl p-5 text-center">
              <div className="font-mono text-[10px] tracking-[0.25em] text-primary/70 mb-3">
                STEP 0{i + 1}
              </div>
              <div
                className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-3 shadow-[0_0_30px_-8px_hsl(280_90%_65%/0.7)]"
                style={{ background: "var(--gradient-hero)" }}
              >
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <div className="font-display font-bold text-lg mb-1.5">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* YOUR DASHBOARD */}
      <section className="mb-16">
        <SectionLabel>YOUR DASHBOARD</SectionLabel>
        <SectionHeading plain="Track it" accent="live." />
        <div className="glass-strong rounded-3xl p-5 md:p-6 mb-4">
          <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground mb-2">
            YOUR UNIQUE LINK
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 text-xs md:text-sm truncate px-3 py-3 rounded-xl bg-background/40 border border-border/60 text-foreground/85">
              {link}
            </code>
            <Button onClick={() => copyTo(link, "link", "Link")} className="sm:w-auto">
              {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "link" ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button variant="outline" className="w-full mt-3" onClick={share}>
            <Share2 className="h-4 w-4" /> Share link
          </Button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="font-display font-semibold">Your referrals</div>
            <div className="text-xs text-muted-foreground">
              {earned} joined · {referrals.length} total
            </div>
          </div>
          {referrals.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm text-muted-foreground">
                No referrals yet — share your link to get started.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(r.at).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full capitalize",
                      r.status === "joined" && "bg-success/15 text-success",
                      r.status === "trial" && "bg-primary/15 text-primary",
                      r.status === "pending" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* PRE-WRITTEN MESSAGE */}
      <section className="mb-12">
        <SectionLabel>PRE-WRITTEN MESSAGE</SectionLabel>
        <h2 className="text-center font-display font-bold text-3xl md:text-5xl leading-[1.05] mb-8">
          Copy<span className="text-foreground">.</span>{" "}
          <span className="prism-text">Paste</span><span className="text-foreground">.</span>{" "}
          <span className="prism-text">Done</span><span className="text-foreground">.</span>
        </h2>
        <div className="glass-strong rounded-3xl p-4 md:p-5">
          <div className="rounded-2xl bg-background/50 border border-border/60 p-4 text-sm text-foreground/85 leading-relaxed mb-3">
            {message}
          </div>
          <Button className="w-full" onClick={() => copyTo(message, "msg", "Message")}>
            {copied === "msg" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied === "msg" ? "Copied" : "Copy message"}
          </Button>
        </div>
      </section>
    </AppShell>
  );
};

export default Referrals;
