import { AppShell, PageHeader } from "@/components/app/AppShell";
import { invoices as mockInvoices } from "@/data/mock";
import { fmtMoney } from "@/lib/format";
import { Check, Download, Sparkles, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  price: number;
  current?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: 199,
    features: [
      "100 AI calls per month",
      "Up to 500 contacts in your client list",
      "125 SMS per month",
      "125 emails per month",
      "SMS & email marketing",
      "SMS appointment confirmations",
      "Calendar sync (Google, Apple, Outlook)",
      "Schedule, reschedule & cancel appointments",
      "Full app & dashboard customized to your business",
      "Built-in calendar in your dashboard",
      "Analytics & reporting",
    ],
  },
  {
    name: "Pro",
    price: 269,
    current: true,
    features: [
      "200 AI calls per month",
      "Up to 1,000 contacts in your client list",
      "250 SMS per month",
      "250 emails per month",
      "SMS & email marketing",
      "SMS appointment confirmations",
      "Calendar sync (Google, Apple, Outlook)",
      "Schedule, reschedule & cancel appointments",
      "Full app & dashboard customized to your business",
      "Built-in calendar in your dashboard",
      "Analytics & reporting",
    ],
  },
  {
    name: "Enterprise",
    price: 0,
    features: [
      "Unlimited AI calls",
      "Unlimited contacts",
      "Custom SMS & email volume",
      "Multi-location & team support",
      "CRM & custom integrations",
      "Priority SLA & support",
    ],
  },
];

const MANAGE_BILLING_URL = "https://sgsaireception.com";

const Billing = () => {
  const isNew = useIsNewCustomer();
  const invoices = isNew ? [] : mockInvoices;
  const current = PLANS.find((p) => p.current)!;
  return (
    <AppShell>
      <PageHeader title="Billing" subtitle="Simple, all-inclusive pricing." />

      <div data-tour="billing-plan" className="glass rounded-2xl p-5 mb-5 gradient-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary">Current plan</div>
            <div className="font-display text-2xl font-semibold mt-1">{current.name}</div>
            <div className="text-sm text-muted-foreground">
              {current.price > 0 ? `$${current.price} / month · billed monthly` : "Custom pricing"}
            </div>
          </div>
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          {current.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-foreground/80">
              <Check className="h-4 w-4 text-success" /> {f}
            </li>
          ))}
        </ul>
        <div className="text-xs text-muted-foreground mt-4">Next payment: <span className="text-foreground">Dec 4, 2025</span></div>
      </div>

      {/* Plan management notice + CTA */}
      <div data-tour="billing-actions" className="glass rounded-2xl p-4 mb-6 border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm">Plan changes happen on our website</div>
            <p className="text-xs text-muted-foreground mt-1">
              To upgrade, downgrade, or cancel your subscription, please manage it from your billing portal on our website.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => window.open(MANAGE_BILLING_URL, "_blank", "noopener,noreferrer")}
            >
              Manage on website <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Read-only plan comparison */}
      <h2 className="font-display text-lg font-semibold mb-3">All plans</h2>
      <div className="grid grid-cols-1 gap-3 mb-8">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={cn(
              "glass rounded-2xl p-4",
              p.current && "gradient-border ring-1 ring-primary/30"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-display text-lg font-semibold flex items-center gap-2">
                  {p.name}
                  {p.current && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.price > 0 ? `$${p.price} / month` : "Contact us"}
                </div>
              </div>
            </div>
            <ul className="space-y-1 text-xs text-foreground/75">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-success shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
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