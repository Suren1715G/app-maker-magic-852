import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Loader2, Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const [resyncing, setResyncing] = useState(false);

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

  const resyncAll = async () => {
    if (!confirm("Re-sync the AI agent for ALL companies? This pushes the latest tools and prompt to every ElevenLabs agent.")) return;
    setResyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-resync-agent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      if (data.failed > 0) {
        toast.warning(`${data.success}/${data.total} re-synced. ${data.failed} failed.`);
      } else {
        toast.success(`Re-synced ${data.success} agent${data.success === 1 ? "" : "s"}.`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Re-sync failed");
    } finally {
      setResyncing(false);
    }
  };

  return (
    <MasterShell
      title="Companies"
      subtitle={`${rows.length} signed up`}
      right={
        <Button size="sm" variant="outline" onClick={resyncAll} disabled={resyncing}>
          {resyncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Re-sync all agents
        </Button>
      }
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