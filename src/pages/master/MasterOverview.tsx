import { useEffect, useState } from "react";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import { Building2, KeyRound, CheckCircle2, Users, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

type Stats = {
  companies: number;
  codesTotal: number;
  codesUsed: number;
  users: number;
  recent: { id: string; name: string; created_at: string }[];
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
        </>
      )}
    </MasterShell>
  );
};

export default MasterOverview;