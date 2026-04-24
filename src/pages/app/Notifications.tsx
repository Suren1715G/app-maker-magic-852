import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { fmtRel } from "@/lib/format";
import {
  Bell, CalendarDays, PhoneMissed, Star, BarChart3, Check,
  MessageSquare, StickyNote, Inbox,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useNotificationPreferences,
  type DbNotification,
} from "@/hooks/useNotifications";

const iconFor = (t: DbNotification["type"]) =>
  t === "lead" ? Bell :
  t === "booking" ? CalendarDays :
  t === "missed" ? PhoneMissed :
  t === "review" ? Star :
  t === "sms" ? MessageSquare :
  t === "note" ? StickyNote :
  BarChart3;

const toneFor = (t: DbNotification["type"]) =>
  t === "lead" ? "text-primary bg-primary/15" :
  t === "booking" ? "text-success bg-success/15" :
  t === "missed" ? "text-accent bg-accent/15" :
  t === "review" ? "text-accent bg-accent/15" :
  t === "sms" ? "text-primary bg-primary/15" :
  t === "note" ? "text-muted-foreground bg-muted" :
  "text-muted-foreground bg-muted";

type PrefKey =
  | "push" | "email" | "daily_summary"
  | "missed_call" | "new_review" | "new_lead" | "new_sms";

const PREF_ROWS: Array<[PrefKey, string, string]> = [
  ["push", "Push notifications", "Instant alerts on this device"],
  ["email", "Email alerts", "Important events to your inbox"],
  ["daily_summary", "Daily 9am summary", "Yesterday's wins"],
  ["new_lead", "New leads", "When the AI captures a new lead"],
  ["missed_call", "Missed call alert", "When the AI couldn't reach the caller"],
  ["new_sms", "New text messages", "When a customer texts you"],
  ["new_review", "New review notifications", "When a customer leaves a review"],
];

const Notifications = () => {
  const navigate = useNavigate();
  const { items, loading, markAllRead, markRead, unreadCount } = useNotifications();
  const { prefs, update } = useNotificationPreferences();

  const handleClick = (n: DbNotification) => {
    if (!n.read) markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        right={
          unreadCount > 0 ? (
            <button onClick={markAllRead} className="text-xs text-primary flex items-center gap-1">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          ) : null
        }
      />

      {loading ? (
        <ul className="space-y-2 mb-8">
          {[0, 1, 2].map((i) => (
            <li key={i} className="glass rounded-2xl p-4 h-16 animate-pulse" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center mb-8">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            We'll alert you here when calls, texts, and leads come in.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 mb-8">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left glass rounded-2xl p-4 flex gap-3 transition-colors hover:bg-secondary/30",
                    !n.read && "ring-1 ring-primary/30",
                  )}
                >
                  <span className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", toneFor(n.type))}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground shrink-0">{fmtRel(n.created_at)}</div>
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="font-display text-lg font-semibold mb-3">Preferences</h2>
      <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-12">
        {PREF_ROWS.map(([k, label, hint]) => (
          <div key={k} className="flex items-center justify-between px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-muted-foreground">{hint}</div>
            </div>
            <Switch
              checked={prefs[k]}
              onCheckedChange={(v) => update({ [k]: v })}
            />
          </div>
        ))}
      </div>
    </AppShell>
  );
};

export default Notifications;