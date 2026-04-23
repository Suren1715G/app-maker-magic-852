import { AppShell, PageHeader } from "@/components/app/AppShell";
import { bookings } from "@/data/mock";
import { fmtDay, fmtTime } from "@/lib/format";
import { CheckCircle2, Clock } from "lucide-react";

const Calendar = () => {
  const sorted = [...bookings].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const grouped = sorted.reduce<Record<string, typeof sorted>>((acc, b) => {
    const k = fmtDay(b.startsAt);
    (acc[k] ||= []).push(b);
    return acc;
  }, {});

  return (
    <AppShell>
      <PageHeader title="Calendar" subtitle="Bookings synced to Google Calendar." />

      <div className="space-y-6">
        {Object.entries(grouped).map(([day, items]) => (
          <section key={day}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-display text-lg font-semibold">{day}</h2>
              <span className="text-xs text-muted-foreground">({items.length})</span>
            </div>
            <ul className="space-y-2">
              {items.map((b) => (
                <li key={b.id} className="glass rounded-2xl p-4 flex gap-4">
                  <div className="flex flex-col items-center justify-center min-w-[72px] bg-primary/10 rounded-xl py-2">
                    <div className="font-display text-lg font-semibold leading-none">{fmtTime(b.startsAt)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {b.durationMin}m
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{b.customer}</div>
                    <div className="text-sm text-muted-foreground truncate">{b.service}</div>
                    <div className="flex items-center gap-1 mt-2 text-xs">
                      {b.smsConfirmed ? (
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> SMS confirmed
                        </span>
                      ) : (
                        <span className="text-muted-foreground">SMS pending</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
};

export default Calendar;
