import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Send, Sparkles, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";
import { useAuth } from "@/contexts/AuthContext";
import { ReferralCubes } from "@/components/app/ReferralCubes";
import { supabase } from "@/integrations/supabase/client";

const BASE_PRICE = 269;
const REFERRAL_SITE_URL = "sgsaireception.com";
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

/**
 * Animates a number from its previous value to `target` by ticking
 * one integer step at a time on a requestAnimationFrame loop.
 * Total duration is bounded so big jumps still finish quickly.
 */
function useCountUp(target: number, totalMs = 450) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / totalMs);
      // ease-out for a quick "settle" feel
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, totalMs]);

  return value;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-center font-mono text-[11px] tracking-[0.25em] text-primary/70 mb-2">
    // {children}
  </div>
);

const SectionHeading = ({ plain, accent }: { plain: string; accent: string }) => (
  <h2 className="text-center font-display font-bold text-3xl md:text-5xl leading-[1.05] mb-10">
    {plain} <span className="prism-text">{accent}</span>
  </h2>
);

const Referrals = () => {
  const isNew = useIsNewCustomer();
  const { user } = useAuth();
  // Live referral counts from the database. Only "qualified" referrals
  // (the referred user actually paid for a subscription) count toward discounts.
  const [earned, setEarned] = useState(0);
  const [pending, setPending] = useState(0);
  const [referrals, setReferrals] = useState<Array<{ id: string; status: string; created_at: string; referred_user_id: string }>>([]);

  // Each user has a unique referral code stored in the database.
  const [refCode, setRefCode] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setRefCode(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setRefCode(data?.code ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load this user's referrals (qualified vs pending counts).
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setEarned(0);
      setPending(0);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("referrals")
        .select("id, status, created_at, referred_user_id")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = data ?? [];
      setReferrals(rows);
      setEarned(rows.filter((r) => r.status === "qualified").length);
      setPending(rows.filter((r) => r.status === "pending").length);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const [picked, setPicked] = useState(Math.max(1, earned));
  const { off: pickedOff, price: pickedPrice } = priceFor(picked);
  const animatedPrice = useCountUp(pickedPrice, 500);
  const animatedSavings = useCountUp(pickedOff, 500);
  const isMax = picked >= 4;
  const currentDiscount = priceFor(earned).off;
  const currentBill = priceFor(earned).price;
  const toGoal = Math.max(0, 4 - earned);

  return (
    <AppShell>
      <div className="relative">
        {/* page-wide floating 3d cubes layer (behind content) */}
        <ReferralCubes />

        <PageHeader title="Referrals" subtitle="Give one month free, get one back." />

        {/* HERO STATUS */}
        <section data-tour="ref-status" className="relative mb-20">
          <div className="glass-strong rounded-3xl p-6 md:p-8 text-center overflow-hidden gradient-border">
            <SectionLabel>YOUR STATUS</SectionLabel>
            <div className="font-display text-6xl md:text-8xl font-bold leading-none mt-2">
              <span className="prism-text">{earned}</span>
              <span className="text-foreground/70"> / 4</span>
            </div>
            <div className="text-sm text-muted-foreground mt-4">
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
        <section data-tour="ref-tiers" className="relative mb-24">
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
                    "hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-20px_hsl(280_90%_65%/0.5)]",
                    reached && "shadow-[0_0_50px_-12px_hsl(280_90%_65%/0.7)] border-primary/40"
                  )}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div
                    className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center font-display text-2xl md:text-3xl font-bold text-white shrink-0 shadow-[inset_0_2px_0_hsl(0_0%_100%/0.3),0_10px_30px_-8px_hsl(280_90%_65%/0.6)]"
                    style={{
                      background: "var(--gradient-hero)",
                      transform: "perspective(600px) rotateX(8deg) rotateY(-8deg)",
                    }}
                  >
                    {t.count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                      {t.count} REFERRAL{t.count === 1 ? "" : "S"}
                    </div>
                    <div className={cn(
                      "font-display font-bold text-lg md:text-2xl",
                      t.count === 4 && "text-muted-foreground/80"
                    )}>
                      {t.label}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs md:text-sm text-muted-foreground line-through mr-2">${BASE_PRICE}</span>
                    <span className={cn(
                      "font-display font-bold text-2xl md:text-4xl",
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
        <section data-tour="ref-calc" className="relative mb-24">
          <SectionLabel>SAVINGS CALCULATOR</SectionLabel>
          <SectionHeading plain="Drag to see" accent="your bill." />
          <div className="glass-strong rounded-3xl p-6 md:p-10 relative overflow-hidden">
            <div className="text-center font-mono text-[11px] tracking-[0.25em] text-muted-foreground mb-5">
              REFERRALS
            </div>
            <div className="flex items-center justify-center gap-8 md:gap-10 mb-8">
              <button
                type="button"
                onClick={() => setPicked((p) => Math.max(0, p - 1))}
                className="h-12 w-12 rounded-full glass flex items-center justify-center text-2xl text-foreground/70 hover:text-foreground hover:scale-105 transition-all border border-white/10"
                aria-label="Decrease"
              >
                −
              </button>
              <div
                key={picked}
                className="font-display text-7xl md:text-9xl font-bold prism-text leading-none w-24 md:w-32 text-center animate-scale-in"
              >
                {picked}
              </div>
              <button
                type="button"
                onClick={() => setPicked((p) => Math.min(4, p + 1))}
                className="h-12 w-12 rounded-full glass flex items-center justify-center text-2xl text-foreground/70 hover:text-foreground hover:scale-105 transition-all border border-white/10"
                aria-label="Increase"
              >
                +
              </button>
            </div>

            {/* Custom gradient slider */}
            <div className="px-2 mb-8">
              <div className="relative h-2 rounded-full bg-secondary/70">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(picked / 4) * 100}%`,
                    background: "linear-gradient(90deg, hsl(320 95% 65%), hsl(280 90% 65%), hsl(190 95% 60%))",
                    boxShadow: "0 0 16px hsl(280 90% 65% / 0.6)",
                  }}
                />
                {[0, 1, 2, 3, 4].map((dot) => (
                  <button
                    key={dot}
                    type="button"
                    onClick={() => setPicked(dot)}
                    aria-label={`${dot} referrals`}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 transition-all",
                      picked >= dot
                        ? "bg-foreground border-foreground scale-110"
                        : "bg-background border-foreground/40"
                    )}
                    style={{ left: `${(dot / 4) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="text-center">
              <div className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground mb-3">
                YOUR BILL NEXT MONTH
              </div>
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-lg md:text-xl text-muted-foreground line-through">${BASE_PRICE}</span>
                <span
                  className={cn(
                    "font-display text-6xl md:text-8xl font-bold tabular-nums",
                    isMax && "prism-text"
                  )}
                >
                  ${animatedPrice}
                </span>
              </div>

              {isMax ? (
                <div className="mt-6 inline-flex">
                  <div
                    className="px-7 py-3 rounded-full font-display font-bold tracking-wide text-sm text-foreground inline-flex items-center gap-2 shadow-[0_0_40px_-5px_hsl(280_90%_65%/0.9)]"
                    style={{
                      background: "linear-gradient(135deg, hsl(330 100% 75%), hsl(280 90% 65%), hsl(190 95% 60%))",
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    FREE MONTH
                  </div>
                </div>
              ) : pickedOff > 0 ? (
                <div className="mt-4 text-sm md:text-base text-accent font-medium tabular-nums">
                  You save ${animatedSavings} this month
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">
                  Refer one detailer to start saving.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="relative mb-24">
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <SectionHeading plain="Three steps." accent="Zero effort." />
          <div className="grid md:grid-cols-3 gap-3 md:gap-4">
            {[
              { icon: Globe, title: "Send detailers to our site", body: `Tell other shops to sign up at ${REFERRAL_SITE_URL} and mention your name.` },
              { icon: Send, title: "They sign up", body: "When they become a paying customer, you get credit automatically." },
              { icon: Sparkles, title: "Discount applies automatically", body: "When they become a paying customer, the discount lands on your next bill — no claim forms." },
            ].map((s, i) => (
              <div key={i} className="glass rounded-2xl p-6 text-center relative overflow-hidden">
                <div
                  className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 shadow-[0_0_40px_-6px_hsl(280_90%_65%/0.85)]"
                  style={{
                    background: "linear-gradient(135deg, hsl(330 100% 75%), hsl(280 90% 60%))",
                  }}
                >
                  <s.icon className="h-7 w-7 text-foreground" />
                </div>
                <div className="font-mono text-[10px] tracking-[0.25em] text-primary/70 mb-2">
                  STEP 0{i + 1}
                </div>
                <div className="font-display font-bold text-lg md:text-xl mb-2">{s.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="relative mb-24">
          <SectionLabel>YOUR DASHBOARD</SectionLabel>
          <SectionHeading plain="Track it" accent="live." />
          <div className="glass-strong rounded-3xl p-5 md:p-7">
            <div className="rounded-2xl bg-background/50 border border-border/60 p-4 md:p-5 mb-6 text-center">
              <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground mb-1">
                REFERRALS HAPPEN ON
              </div>
              <div className="font-display text-xl md:text-2xl font-bold">
                {REFERRAL_SITE_URL}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Tell other detailers to sign up there and mention your name.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-5">
              <div className="rounded-2xl bg-background/50 border border-border/60 p-3 md:p-4">
                <div className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground mb-1">
                  REFERRALS THIS MONTH
                </div>
                <div className="font-display text-2xl md:text-3xl font-bold">{earned}</div>
              </div>
              <div className="rounded-2xl bg-background/50 border border-border/60 p-3 md:p-4">
                <div className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground mb-1">
                  CURRENT DISCOUNT
                </div>
                <div className="font-display text-2xl md:text-3xl font-bold prism-text">
                  ${currentDiscount}
                </div>
              </div>
              <div className="rounded-2xl bg-background/50 border border-border/60 p-3 md:p-4">
                <div className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-muted-foreground mb-1">
                  NEXT BILL
                </div>
                <div className="font-display text-2xl md:text-3xl font-bold">${currentBill}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
                  PROGRESS TO NEXT TIER
                </div>
                <div className="font-mono text-[11px] text-foreground/80">
                  {earned} / 4
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (earned / 4) * 100)}%`,
                    background: "var(--gradient-hero)",
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {earned >= 4 ? "You've maxed out — enjoy your free month." : `${toGoal} more for a free month.`}
              </div>
            </div>
          </div>

          {/* Referrals list */}
          <div className="glass rounded-2xl overflow-hidden mt-4">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <div className="font-display font-semibold">Your referrals</div>
              <div className="text-xs text-muted-foreground">
                {earned} joined · {referrals.length} total
              </div>
            </div>
            {referrals.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No referrals yet — share your link to get started.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <div className="text-sm font-medium">Referred user</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full capitalize",
                        r.status === "qualified" && "bg-success/15 text-success",
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
        <section className="relative mb-16">
          <SectionLabel>PRE-WRITTEN MESSAGE</SectionLabel>
          <h2 className="text-center font-display font-bold text-3xl md:text-5xl leading-[1.05] mb-10">
            <span className="text-foreground">Copy.</span>{" "}
            <span className="prism-text">Paste</span>
            <span className="text-foreground">.</span>{" "}
            <span className="prism-text">Done</span>
            <span className="text-foreground">.</span>
          </h2>
          <div className="glass-strong rounded-3xl p-4 md:p-6">
            <div className="rounded-2xl bg-background/60 border border-border/60 p-5 text-sm md:text-base text-foreground/85 leading-relaxed mb-4">
              {message}
            </div>
            <Button className="w-full" size="lg" onClick={() => copyTo(message, "msg", "Message")}>
              {copied === "msg" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied === "msg" ? "Copied" : "Copy message"}
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Referrals;
