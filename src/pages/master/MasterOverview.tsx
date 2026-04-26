import { useEffect, useState } from "react";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import { Building2, KeyRound, CheckCircle2, Users, Loader2, MapPin, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Stats = {
  companies: number;
  codesTotal: number;
  codesUsed: number;
  users: number;
  recent: { id: string; name: string; created_at: string }[];
};

type PendingRequest = {
  id: string;
  location_name: string;
  locations_wanted: number;
  note: string | null;
  status: "new" | "contacted" | "scheduled" | "closed";
  created_at: string;
  company_id: string;
  companies: { name: string } | null;
};

const StatTile = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <div className="glass rounded-2xl p-5">
    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <div className="font-display text-3xl font-semibold mt-2">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const MasterOverview = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingRequest[] | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadPending = async () => {
    const { data } = await supabase
      .from("location_requests")
      .select("id, location_name, locations_wanted, note, status, created_at, company_id, companies(name)")
      .in("status", ["new", "contacted"])
      .order("created_at", { ascending: false });
    setPending((data ?? []) as unknown as PendingRequest[]);
  };

  const approve = async (r: PendingRequest) => {
    setActingId(r.id);
    // Mark request scheduled (= confirmed/being provisioned) and add a phone-number
    // placeholder under the company so the customer immediately sees a new location
    // entry on their dashboard. Owner can fill in the real number afterwards.
    const { error: insertErr } = await supabase.from("company_phone_numbers").insert({
      company_id: r.company_id,
      label: r.location_name,
      phone_number: "Pending assignment",
      provider: "twilio",
      status: "pending",
    });
    if (insertErr) {
      setActingId(null);
      return toast.error(insertErr.message);
    }
    const { error: updateErr } = await supabase
      .from("location_requests")
      .update({ status: "scheduled" })
      .eq("id", r.id);
    setActingId(null);
    if (updateErr) return toast.error(updateErr.message);
    toast.success(`Approved — added "${r.location_name}" to ${r.companies?.name ?? "company"}`);
    await loadPending();
  };

  const decline = async (r: PendingRequest) => {
    setActingId(r.id);
    const { error } = await supabase
      .from("location_requests")
      .update({ status: "closed" })
      .eq("id", r.id);
    setActingId(null);
    if (error) return toast.error(error.message);
    toast.success("Request declined");
    await loadPending();
  };

  useEffect(() => {
    (async () => {
      const [{ count: companies }, { data: codes }, { count: users }, { data: recent }] =
        await Promise.all([
          supabase.from("companies").select("*", { count: "exact", head: true }),
          supabase.from("access_codes").select("used_at"),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("companies").select("id, name, created_at").order("created_at", {
            ascending: false,
          }).limit(5),
        ]);

      const codesTotal = codes?.length ?? 0;
      const codesUsed = codes?.filter((c) => c.used_at).length ?? 0;

      setStats({
        companies: companies ?? 0,
        codesTotal,
        codesUsed,
        users: users ?? 0,
        recent: (recent as { id: string; name: string; created_at: string }[]) ?? [],
      });
      await loadPending();
    })();
  }, []);

  return (
    <MasterShell
      title="Overview"
      subtitle="Everything happening across SGS, at a glance."
    >
      {!stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatTile icon={Building2} label="Companies" value={stats.companies} />
            <StatTile icon={Users} label="Users" value={stats.users} />
            <StatTile
              icon={CheckCircle2}
              label="Codes redeemed"
              value={stats.codesUsed}
              hint={`${stats.codesTotal - stats.codesUsed} unused`}
            />
            <StatTile
              icon={KeyRound}
              label="Codes issued"
              value={stats.codesTotal}
            />
          </div>

          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Recent signups
          </h2>
          <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
            {stats.recent.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No companies yet.
              </div>
            )}
            {stats.recent.map((c) => (
              <Link
                key={c.id}
                to={`/master/companies/${c.id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>

          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 mt-8 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Pending location requests
            {pending && pending.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                {pending.length}
              </span>
            )}
          </h2>
          <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
            {pending === null && (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {pending && pending.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No pending requests. New ones from companies will appear here.
              </div>
            )}
            {pending?.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{r.location_name}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <Link
                      to={`/master/companies/${r.company_id}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {r.companies?.name ?? "Unknown company"}
                    </Link>
                    {" · "}
                    {r.locations_wanted} location{r.locations_wanted > 1 ? "s" : ""}
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  {r.note && (
                    <div className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">
                      {r.note}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approve(r)}
                    disabled={actingId === r.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-success/15 text-success hover:bg-success/25 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => decline(r)}
                    disabled={actingId === r.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary text-foreground/80 hover:bg-destructive/15 hover:text-destructive disabled:opacity-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </MasterShell>
  );
};

export default MasterOverview;