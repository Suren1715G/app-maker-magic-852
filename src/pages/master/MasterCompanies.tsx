import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type CompanyRow = {
  id: string;
  name: string;
  created_at: string;
  profiles: { display_name: string | null; user_id: string }[];
  access_codes: { id: string; used_at: string | null }[];
};

const MasterCompanies = () => {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, created_at, profiles(display_name, user_id), access_codes(id, used_at)")
        .order("created_at", { ascending: false });
      setRows((data as CompanyRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <MasterShell
      title="Companies"
      subtitle={`${rows.length} signed up`}
    >
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground md:col-span-2">
              No companies match.
            </div>
          )}
          {filtered.map((c) => {
            const usedCodes = c.access_codes.filter((k) => k.used_at).length;
            return (
              <Link
                key={c.id}
                to={`/master/companies/${c.id}`}
                className="glass rounded-2xl p-5 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-center">
                  <div className="rounded-lg bg-secondary/30 py-2">
                    <div className="text-lg font-semibold">{c.profiles.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Users
                    </div>
                  </div>
                  <div className="rounded-lg bg-secondary/30 py-2">
                    <div className="text-lg font-semibold">
                      {usedCodes}/{c.access_codes.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Codes used
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </MasterShell>
  );
};

export default MasterCompanies;