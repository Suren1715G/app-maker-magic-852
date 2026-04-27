import { AppShell, PageHeader } from "@/components/app/AppShell";
import { invoices as mockInvoices } from "@/data/mock";
import { fmtMoney } from "@/lib/format";
import { Check, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";

const Billing = () => {
  const isNew = useIsNewCustomer();
  const invoices = isNew ? [] : mockInvoices;
  return (
    <AppShell>
      <PageHeader title="Billing" subtitle="Simple, all-inclusive pricing." />

      <div data-tour="billing-plan" className="glass rounded-2xl p-5 mb-5 gradient-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary">Current plan</div>
            <div className="font-display text-2xl font-semibold mt-1">Pro</div>
            <div className="text-sm text-muted-foreground">$149 / month · billed monthly</div>
          </div>
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          {["Unlimited AI calls", "SMS confirmations", "Google Calendar sync", "Lead CRM", "Analytics & reports"].map((f) => (
            <li key={f} className="flex items-center gap-2 text-foreground/80">
              <Check className="h-4 w-4 text-success" /> {f}
            </li>
          ))}
        </ul>
        <div className="text-xs text-muted-foreground mt-4">Next payment: <span className="text-foreground">Dec 4, 2025</span></div>
      </div>

      <div data-tour="billing-actions" className="grid grid-cols-2 gap-2 mb-6">
        <Button variant="outline" onClick={() => toast.info("Plan options coming soon")}>Change plan</Button>
        <Button
          variant="outline"
          onClick={() =>
            toast("Wait — get 50% off for 2 months?", {
              action: { label: "Stay", onClick: () => toast.success("Discount applied 🎉") },
              cancel: { label: "Cancel anyway", onClick: () => toast.info("We're sorry to see you go.") },
              duration: 8000,
            })
          }
        >
          Cancel
        </Button>
      </div>

      <h2 data-tour="billing-invoices-heading" className="font-display text-lg font-semibold mb-3">Invoice history</h2>
      {invoices.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground mb-12">
          No invoices yet.
        </div>
      ) : (
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-12">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">{inv.number}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(inv.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{fmtMoney(inv.amount)}</span>
              <button
                onClick={() => toast.success(`Downloaded ${inv.number}.pdf`)}
                className="text-muted-foreground hover:text-primary"
                aria-label="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      )}
    </AppShell>
  );
};

export default Billing;