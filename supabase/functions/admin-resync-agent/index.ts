// Admin-only: re-provision (upgrade) the ElevenLabs agent for one company
// or all companies. Pushes the latest tools + prompt without creating a new agent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ASSISTANT_TOOL_SECRET = Deno.env.get("ASSISTANT_TOOL_SECRET")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const company_id = body?.company_id ? String(body.company_id) : null;
    const all = body?.all === true;

    let companyIds: string[] = [];
    if (all) {
      const { data: rows } = await admin
        .from("company_elevenlabs_agents")
        .select("company_id");
      companyIds = (rows ?? []).map((r: any) => r.company_id);
    } else if (company_id) {
      companyIds = [company_id];
    } else {
      return json({ error: "company_id or all=true required" }, 400);
    }

    const results: Array<{ company_id: string; ok: boolean; error?: string }> = [];
    for (const cid of companyIds) {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/provision-company-agent`,
          {
            method: "POST",
            headers: {
              "x-internal-secret": ASSISTANT_TOOL_SECRET,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ company_id: cid }),
          },
        );
        const data = await r.json();
        if (!r.ok) {
          results.push({ company_id: cid, ok: false, error: data?.error ?? `HTTP ${r.status}` });
        } else {
          results.push({ company_id: cid, ok: true });
        }
      } catch (e) {
        results.push({ company_id: cid, ok: false, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    return json({
      ok: true,
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (e) {
    console.error("admin-resync-agent error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
