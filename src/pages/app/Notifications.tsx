import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { notifications as mockNotifications, type AppNotification } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { Bell, CalendarDays, PhoneMissed, Star, BarChart3, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useIsNewCustomer } from "@/hooks/useIsNewCustomer";

const iconFor = (t: AppNotification["type"]) =>
  t === "lead" ? Bell : t === "booking" ? CalendarDays : t === "missed" ? PhoneMissed : t === "review" ? Star : BarChart3;

const toneFor = (t: AppNotification["type"]) =>
  t === "lead" ? "text-primary bg-primary/15" :
  t === "booking" ? "text-success bg-success/15" :
  t === "missed" ? "text-accent bg-accent/15" :
  t === "review" ? "text-accent bg-accent/15" : "text-muted-foreground bg-muted";

const Notifications = () => {
  const isNew = useIsNewCustomer();
  const [items, setItems] = useState<AppNotification[]>(isNew ? [] : mockNotifications);
  const [prefs, setPrefs] = useState({ push: true, email: true, dailySummary: true, missedCall: true, newReview: false });

  const markAll = () => setItems((p) => p.map((n) => ({ ...n, read: true })));
  const unread = items.filter((n) => !n.read).length;
  const byType = items.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});
  const notifSummary =
    `Notifications overview — total ${items.length}, unread ${unread}. By type: ` +
    Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(", ") + ".";

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        subtitle="Never miss a lead."
        right={
          <button onClick={markAll} className="text-xs text-primary flex items-center gap-1">
            <Check className="h-3 w-3" /> Mark all read
          </button>
        }
      />
      <p className="sr-only" aria-label={notifSummary}>{notifSummary}</p>

      <ul className="space-y-2 mb-8">
        {items.map((n) => {
          const Icon = iconFor(n.type);
          const notifLabel =
            `${n.read ? "Read" : "Unread"} ${n.type} notification: ${n.title}. ${n.body} ` +
            `Received ${new Date(n.at).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}.`;
          return (
            <li key={n.id} aria-label={notifLabel} className={cn("glass rounded-2xl p-4 flex gap-3", !n.read && "ring-1 ring-primary/30")}>
              <span className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", toneFor(n.type))}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{n.title}</div>
                  <div className="text-[11px] text-muted-foreground shrink-0">{fmtRel(n.at)}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="font-display text-lg font-semibold mb-3">Preferences</h2>
      <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-12">
        {[
          ["push", "Push notifications", "Instant alerts on this device"],
          ["email", "Email alerts", "Important events to your inbox"],
          ["dailySummary", "Daily 9am summary", "Yesterday's wins"],
          ["missedCall", "Missed call alert", "When the AI couldn't reach the caller"],
          ["newReview", "New review notifications", "When a customer leaves a review"],
        ].map(([k, label, hint]) => (
          <div key={k} className="flex items-center justify-between px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-muted-foreground">{hint}</div>
            </div>
            <Switch
              checked={(prefs as any)[k]}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, [k as string]: v }))}
            />
          </div>
        ))}
      </div>
    </AppShell>
  );
};

export default Notifications;