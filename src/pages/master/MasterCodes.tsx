import { useEffect, useState } from "react";
import { MasterShell } from "@/components/master/MasterShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Loader2, Plus } from "lucide-react";

type Company = { id: string; name: string };
type AccessCode = {
  id: string;
  code: string;
  company_id: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
  notes: string | null;
  companies?: { name: string } | null;
};

function generateCode(prefix = "SGS") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${rand(4)}-${rand(4)}`;
}

const MasterCodes = () => {
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: ks }] = await Promise.all([
      supabase.from("companies").select("id, name").order("created_at", { ascending: false }),
      supabase
        .from("access_codes")
        .select("*, companies(name)")
        .order("created_at", { ascending: false }),
    ]);
    setCompanies((cs as Company[]) ?? []);
    setCodes((ks as AccessCode[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setCreating(true);
    try {
      const { data: company, error: e1 } = await supabase
        .from("companies")
        .insert({ name: companyName.trim() })
        .select()
        .single();
      if (e1) throw e1;

      const code = generateCode();
      const { error: e2 } = await supabase.from("access_codes").insert({
        code,
        company_id: company.id,
        notes: notes.trim() || null,
      });
      if (e2) throw e2;

      toast.success(`Code generated: ${code}`);
      setCompanyName("");
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Copied");
  };

  return (
    <MasterShell
      title="Access codes"
      subtitle={`${codes.length} issued · ${companies.length} companies`}
    >
      <form
        onSubmit={handleCreate}
        className="glass rounded-2xl p-5 grid md:grid-cols-[1fr_1fr_auto] gap-3 mb-8 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cname">Company name</Label>
          <Input
            id="cname"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Cleaning Co."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Stripe sub_xxx · Annual"
          />
        </div>
        <Button type="submit" disabled={creating} className="md:w-auto">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Generate
        </Button>
      </form>

      <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
        {loading && (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && codes.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No codes yet. Generate one above.
          </div>
        )}
        {codes.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-semibold tracking-wider">{c.code}</div>
              <div className="text-xs text-muted-foreground truncate">
                {c.companies?.name ?? "—"}
                {c.notes ? ` · ${c.notes}` : ""}
              </div>
            </div>
            <span
              className={`text-[10px] uppercase font-semibold px-2 py-1 rounded-full ${
                c.used_at
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {c.used_at ? "Used" : "Available"}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => copy(c.code)}
              aria-label="Copy code"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </MasterShell>
  );
};

export default MasterCodes;