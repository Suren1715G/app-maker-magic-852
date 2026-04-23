import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Loader2,
  MessageSquare,
  Phone,
  User,
} from "lucide-react";
import { calls, bookings, sms } from "@/data/mock";

type Detail = {
  id: string;
  name: string;
  created_at: string;
  profiles: {
    user_id: string;
    display_name: string | null;
    business_name: string | null;
    created_at: string;
  }[];
  access_codes: {
    id: string;
    code: string;
    used_at: string | null;
    used_by: string | null;
    notes: string | null;
    created_at: string;
  }[];
};

const MasterCompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: row, error } = await supabase
        .from("companies")
        .select(
          "id, name, created_at, profiles(user_id, display_name, business_name, created_at), access_codes(id, code, used_at, used_by, notes, created_at)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !row) {
        setNotFound(true);
        return;
      }
      setData(row as Detail);
    })();
  }, [id]);

  // Note: live customer data lives in the company's own tables which we haven't
  // built yet (calls/bookings/sms are still mock for the customer dashboard).
  // We show the same mock data here as a placeholder so the drill-down has
  // something visual until real per-company data is wired up.
  const recentCalls = calls.slice(0, 3);
  const upcoming = bookings.slice(0, 3);
  const recentSms = sms.slice(0, 3);

  return (
    <MasterShell
      title={data?.name ?? (notFound ? "Not found" : "Loading…")}
      subtitle={data ? `Joined ${new Date(data.created_at).toLocaleDateString()}` : undefined}
      right={
        <Link
          to="/master/companies"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      }
    >
      {notFound && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          That company doesn't exist (or was removed).
        </div>
      )}

      {!data && !notFound && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: company info */}
          <div className="lg:col-span-1 space-y-5">
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Users ({data.profiles.length})
              </h2>
              {data.profiles.length === 0 && (
                <p className="text-sm text-muted-foreground">No users yet.</p>
              )}
              <ul className="space-y-2">
                {data.profiles.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                      {(p.display_name?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {p.display_name ?? "Unnamed user"}
                      </div>
                      {p.business_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {p.business_name}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Access codes
              </h2>
              <ul className="space-y-2">
                {data.access_codes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-mono text-xs tracking-wider truncate">
                      {c.code}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                        c.used_at
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {c.used_at ? "Used" : "Open"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right: activity preview */}
          <div className="lg:col-span-2 space-y-5">
            <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
              Activity below is sample data — real customer call/SMS/booking history will appear here once the customer-facing data is wired up to the backend.
            </div>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Recent calls
              </h2>
              <ul className="divide-y divide-border/40">
                {recentCalls.map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.caller}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.summary}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Upcoming bookings
              </h2>
              <ul className="divide-y divide-border/40">
                {upcoming.map((b) => (
                  <li key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{b.customer}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {b.service} · {new Date(b.startsAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Recent SMS
              </h2>
              <ul className="divide-y divide-border/40">
                {recentSms.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <div className="text-sm font-medium">{s.customer}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {s.body}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </MasterShell>
  );
};

export default MasterCompanyDetail;