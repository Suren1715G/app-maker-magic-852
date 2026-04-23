import { AppShell, PageHeader } from "@/components/app/AppShell";
import { sms } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { CheckCheck, Clock } from "lucide-react";

const Sms = () => {
  const list = [...sms].sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
  return (
    <AppShell>
      <PageHeader title="SMS" subtitle="Confirmations sent in milliseconds." />
      <ul className="space-y-2">
        {list.map((m) => (
          <li key={m.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-medium truncate">{m.customer}</div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {m.type}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mb-2">{m.to}</div>
            <p className="text-sm leading-relaxed">{m.body}</p>
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-muted-foreground">{fmtRel(m.sentAt)}</span>
              {m.delivered ? (
                <span className="text-success flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Delivered
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Sending
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
};

export default Sms;
