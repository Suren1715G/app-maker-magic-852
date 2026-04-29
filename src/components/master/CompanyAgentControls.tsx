import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

type AgentRow = {
  ai_system_prompt: string | null;
  ai_first_message: string | null;
  ai_voice_id: string | null;
};

export function CompanyAgentControls({ companyId }: { companyId: string }) {
  const [row, setRow] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [hasAgent, setHasAgent] = useState(false);

  const [voice, setVoice] = useState("");
  const [first, setFirst] = useState("");
  const [prompt, setPrompt] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase
        .from("companies")
        .select("ai_system_prompt, ai_first_message, ai_voice_id")
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("company_elevenlabs_agents")
        .select("agent_id")
        .eq("company_id", companyId)
        .maybeSingle(),
    ]);
    setRow((c as AgentRow) ?? null);
    setVoice(c?.ai_voice_id ?? "");
    setFirst(c?.ai_first_message ?? "");
    setPrompt(c?.ai_system_prompt ?? "");
    setHasAgent(Boolean(a?.agent_id));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [companyId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          ai_voice_id: voice.trim() || null,
          ai_first_message: first.trim() || null,
          ai_system_prompt: prompt.trim() || null,
        })
        .eq("id", companyId);
      if (error) throw error;
      toast.success("Saved. Re-sync the agent to push these changes to ElevenLabs.");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const resync = async () => {
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
        body: JSON.stringify({ company_id: companyId }),
      });
      const data = await res.json();
      if (!res.ok || data?.failed) {
        throw new Error(data?.results?.[0]?.error ?? data?.error ?? "Re-sync failed");
      }
      toast.success("Agent re-synced with the latest tools and prompt.");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Re-sync failed");
    } finally {
      setResyncing(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" /> AI receptionist
        </h2>
        <span
          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
            hasAgent ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {hasAgent ? "Provisioned" : "Not provisioned"}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Voice ID (ElevenLabs)</label>
            <Input
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="Leave blank to use template default"
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">First message</label>
            <Textarea
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="What the AI says first (e.g. 'Thanks for calling Acme — how can I help?')"
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Custom system prompt (optional)</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Extra instructions on top of the default receptionist prompt."
              rows={5}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              The default receptionist prompt and tools are always included automatically.
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={resync} disabled={resyncing}>
              {resyncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Re-sync agent
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            "Re-sync" pushes the latest tools (booking, lookups, actions) and any saved overrides
            to this company's ElevenLabs agent. Run it after changing voice / first message / prompt,
            or whenever new tools are added.
          </p>
        </div>
      )}
    </section>
  );
}
