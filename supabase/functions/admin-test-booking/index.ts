// Admin-only test harness: hits assistant-booking with the shared secret on
// behalf of the admin so the Master panel can verify a company's booking
// integration without making a real phone call.
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
    const company_id = String(body?.company_id ?? "");
    if (!company_id) return json({ error: "company_id required" }, 400);
    const action = String(body?.action ?? "get_provider");

    // Build a passthrough payload — defaults to a check_availability for the
    // next 7 days when action=check_availability and no time given.
    const passthrough: Record<string, unknown> = { ...body };
    if (action === "check_availability" && !body?.start_time) {
      const now = new Date();
      passthrough.start_time = now.toISOString();
      passthrough.end_time = new Date(now.getTime() + 7 * 24 * 3600_000).toISOString();
    }

    const r = await fetch(`${SUPABASE_URL}/functions/v1/assistant-booking`, {
      method: "POST",
      headers: {
        "x-assistant-secret": ASSISTANT_TOOL_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(passthrough),
    });
    const data = await r.json();
    return json({ ok: r.ok, status: r.status, data });
  } catch (e) {
    console.error("admin-test-booking error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
