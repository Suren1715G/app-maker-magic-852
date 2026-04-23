import { AppShell, PageHeader } from "@/components/app/AppShell";
import { referrals as mockReferrals } from "@/data/mock";
import { Copy, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";

const link = "https://sgs.ai/r/sgs-marcus";

const Referrals = () => {
  const isNew = useIsNewCustomer();
  const referrals = isNew ? [] : mockReferrals;
  const earned = referrals.filter((r) => r.status === "joined").length;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Try SGS", url: link }); } catch {}
    } else copy();
  };

  return (
    <AppShell>
      <PageHeader title="Referrals" subtitle="Give one month free, get one back." />

      <div className="glass rounded-2xl p-5 mb-5 text-center gradient-border">
        <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
        <div className="font-display text-2xl font-semibold">{earned} free month{earned === 1 ? "" : "s"} earned</div>
        <div className="text-sm text-muted-foreground">Each successful referral = 1 month off your bill.</div>
      </div>

      <div className="glass rounded-2xl p-3 mb-3 flex items-center gap-2">
        <code className="flex-1 text-xs truncate px-2 text-foreground/80">{link}</code>
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
      </div>
      <Button className="w-full mb-6" onClick={share}>
        <Share2 className="h-4 w-4" /> Share link
      </Button>

      <h2 className="font-display text-lg font-semibold mb-3">Your referrals</h2>
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-12">
        {referrals.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(r.at).toLocaleDateString()}</div>
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
    </AppShell>
  );
};

export default Referrals;