import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ChevronDown, MessageSquare, Lightbulb, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const faqs = [
  { q: "How does the AI know my services & pricing?", a: "You configure your services and prices in Settings. The AI references those when answering callers." },
  { q: "What happens on a missed call?", a: "If the AI can't answer or the caller hangs up, an automatic SMS follow-up is sent within 5 seconds." },
  { q: "Can I forward my existing number?", a: "Yes — we provide a forwarding number you set on your existing line. Calls reroute to the AI seamlessly." },
  { q: "Will customers know they're talking to AI?", a: "By default no, the voice is natural. You can enable a disclosure in Settings if your industry requires it." },
  { q: "How do reviews get auto-requested?", a: "After a successful booking is completed, the AI texts the customer with a one-tap link to your Google review page." },
];

const Support = () => {
  const [open, setOpen] = useState<number | null>(0);
  const [feature, setFeature] = useState("");

  return (
    <AppShell>
      <PageHeader title="Support" subtitle="We're one tap away." />

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => toast.info("Live chat opening soon — for now: support@sgs.ai")}
          className="glass rounded-2xl p-4 text-left"
        >
          <MessageSquare className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-semibold">Chat with us</div>
          <div className="text-[11px] text-muted-foreground">Reply in &lt; 1h</div>
        </button>
        <button
          onClick={() => toast.info("Onboarding tour coming soon")}
          className="glass rounded-2xl p-4 text-left"
        >
          <BookOpen className="h-5 w-5 text-primary mb-2" />
          <div className="text-sm font-semibold">Get started tour</div>
          <div className="text-[11px] text-muted-foreground">5 min walk-through</div>
        </button>
      </div>

      <h2 className="font-display text-lg font-semibold mb-3">FAQ</h2>
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-6">
        {faqs.map((f, i) => (
          <li key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-medium">{f.q}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-muted-foreground">{f.a}</div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-accent" /> Request a feature
      </h2>
      <div className="glass rounded-2xl p-4 mb-12">
        <textarea
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          placeholder="What would make SGS perfect for you?"
          rows={3}
          className="w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          className="w-full mt-3"
          disabled={!feature.trim()}
          onClick={() => { toast.success("Sent! We read every one."); setFeature(""); }}
        >
          Submit
        </Button>
      </div>
    </AppShell>
  );
};

export default Support;