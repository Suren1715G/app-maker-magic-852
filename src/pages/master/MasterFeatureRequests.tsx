import { useEffect, useState } from "react";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Req = {
  id: string;
  company_id: string;
  submitted_by: string;
  body: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  company_name?: string;
  submitter_name?: string;
};

const STATUSES = ["new", "reviewing", "planned", "shipped", "declined"] as const;

const statusStyle = (s: string) => {
  switch (s) {
    case "new": return "bg-primary/15 text-primary border-primary/30";
    case "reviewing": return "bg-accent/15 text-accent border-accent/30";
    case "planned": return "bg-warning/15 text-warning border-warning/30";
    case "shipped": return "bg-success/15 text-success border-success/30";
    case "declined": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-secondary text-muted-foreground border-border";
  }
};

const MasterFeatureRequests = () => {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: r } = await supabase
      .from("feature_requests")
      .select("id, company_id, submitted_by, body, status, admin_notes, created_at")
      .order("created_at", { ascending: false });
    if (!r) { setReqs([]); setLoading(false); return; }

    const companyIds = Array.from(new Set(r.map((x) => x.company_id)));
    const userIds = Array.from(new Set(r.map((x) => x.submitted_by)));
    const [{ data: companies }, { data: profiles }] = await Promise.all([
      supabase.from("companies").select("id, name").in("id", companyIds),
      supabase.from("profiles").select("user_id, display_name, business_name").in("user_id", userIds),
    ]);
    const cMap = new Map((companies ?? []).map((c) => [c.id, c.name]));
    const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name || p.business_name]));
    setReqs(r.map((x) => ({
      ...x,
      company_name: cMap.get(x.company_id),
      submitter_name: pMap.get(x.submitted_by),
    })) as Req[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("master-feature-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("feature_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Marked ${status}`);
  };

  const updateNotes = async (id: string, admin_notes: string) => {
    const { error } = await supabase.from("feature_requests").update({ admin_notes }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this feature request?")) return;
    const { error } = await supabase.from("feature_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  };

  const filtered = filter === "all" ? reqs : reqs.filter((r) => r.status === filter);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = reqs.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MasterShell title="Feature requests" subtitle="Everything customers wish SGS could do.">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
            filter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          All · {reqs.length}
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors capitalize",
              filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s} · {counts[s] ?? 0}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">No feature requests {filter !== "all" ? `with status "${filter}"` : "yet"}.</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{r.company_name ?? "Unknown company"}</span>
                    {r.submitter_name && <span>· {r.submitter_name}</span>}
                    <span>· {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{r.body}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium border capitalize shrink-0", statusStyle(r.status))}>
                  {r.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(r.id, s)}
                    disabled={r.status === s}
                    className={cn(
                      "text-[11px] rounded-full px-2.5 py-1 border transition-colors capitalize",
                      r.status === s
                        ? "border-primary bg-primary/10 text-primary cursor-default"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => remove(r.id)}
                  className="text-[11px] rounded-full px-2.5 py-1 border border-border text-destructive hover:bg-destructive/10 ml-auto"
                >
                  Delete
                </button>
              </div>

              <textarea
                defaultValue={r.admin_notes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (r.admin_notes ?? "")) updateNotes(r.id, e.target.value);
                }}
                placeholder="Internal notes…"
                rows={2}
                className="w-full rounded-xl bg-input border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </li>
          ))}
        </ul>
      )}
    </MasterShell>
  );
};

export default MasterFeatureRequests;
