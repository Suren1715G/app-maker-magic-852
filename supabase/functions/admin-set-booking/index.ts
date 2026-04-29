// Admin-only endpoint to configure Calendly or Acuity for a company,
// or clear an existing booking integration.
//
// POST { provider: "calendly", company_id, calendly_access_token, calendly_event_type_uri }
// POST { provider: "acuity",   company_id, acuity_user_id, acuity_api_key, appointment_type_id }
// POST { action: "clear", company_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing Authorization" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id as string | undefined;
    if (!companyId) return json({ error: "Missing company_id" }, 400);

    if (body.action === "clear") {
      const { error } = await userClient.rpc("admin_clear_company_booking", { _company_id: companyId });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (body.provider === "calendly") {
      const token = body.calendly_access_token as string | undefined;
      const eventTypeUri = body.calendly_event_type_uri as string | undefined;
      if (!token || !eventTypeUri) return json({ error: "Missing Calendly fields" }, 400);

      // Validate token by fetching the user
      const meRes = await fetch("https://api.calendly.com/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) return json({ error: `Calendly token invalid: ${JSON.stringify(me)}` }, 400);
      const userUri = me.resource?.uri ?? null;
      const schedulingUrl = me.resource?.scheduling_url ?? null;

      const { error } = await userClient.rpc("admin_set_company_calendly", {
        _company_id: companyId,
        _access_token: token,
        _user_uri: userUri,
        _event_type_uri: eventTypeUri,
        _scheduling_url: schedulingUrl,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, user_uri: userUri, scheduling_url: schedulingUrl });
    }

    if (body.provider === "acuity") {
      const userId = body.acuity_user_id as string | undefined;
      const apiKey = body.acuity_api_key as string | undefined;
      const apptType = (body.acuity_appointment_type_id as string | undefined) ?? null;
      if (!userId || !apiKey) return json({ error: "Missing Acuity fields" }, 400);

      // Validate creds
      const basic = btoa(`${userId}:${apiKey}`);
      const meRes = await fetch("https://acuityscheduling.com/api/v1/me", {
        headers: { Authorization: `Basic ${basic}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) return json({ error: `Acuity creds invalid: ${JSON.stringify(me)}` }, 400);

      const { error } = await userClient.rpc("admin_set_company_acuity", {
        _company_id: companyId,
        _user_id: userId,
        _api_key: apiKey,
        _appointment_type_id: apptType,
        _scheduling_url: me?.scheduling_page ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, scheduling_url: me?.scheduling_page ?? null });
    }

    return json({ error: "Unknown provider/action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("admin-set-booking error", msg);
    return json({ error: msg }, 500);
  }
});