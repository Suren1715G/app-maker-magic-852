// Company-side booking management — for company_admin users to:
// - connect Squarespace (Acuity) from their dashboard
// - clear current booking integration
// - list Acuity appointments (for the client Calendar page)
//
// POST { action: "connect_acuity", acuity_user_id, acuity_api_key, acuity_appointment_type_id? }
// POST { action: "clear" }
// POST { action: "list_acuity_appointments", min?: ISO, max?: ISO }

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
    const isCompanyAdmin = (roles ?? []).some((r: any) => r.role === "company_admin");
    if (!isCompanyAdmin) return json({ error: "Forbidden: company_admin only" }, 403);

    const { data: profile } = await admin
      .from("profiles").select("company_id").eq("user_id", u.user.id).maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) return json({ error: "No company linked" }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "clear") {
      const { error } = await userClient.rpc("company_clear_booking");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "connect_acuity") {
      const userId = String(body.acuity_user_id ?? "").trim();
      const apiKey = String(body.acuity_api_key ?? "").trim();
      const apptType = body.acuity_appointment_type_id
        ? String(body.acuity_appointment_type_id).trim()
        : null;
      if (!userId || !apiKey) return json({ error: "User ID and API key required" }, 400);

      // Validate creds
      const basic = btoa(`${userId}:${apiKey}`);
      const meRes = await fetch("https://acuityscheduling.com/api/v1/me", {
        headers: { Authorization: `Basic ${basic}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) return json({ error: `Invalid Acuity credentials: ${me?.message ?? "check User ID and API Key"}` }, 400);

      const { error } = await userClient.rpc("company_set_acuity", {
        _user_id: userId,
        _api_key: apiKey,
        _appointment_type_id: apptType,
        _scheduling_url: me?.scheduling_page ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, scheduling_url: me?.scheduling_page ?? null });
    }

    if (action === "list_acuity_appointments") {
      const { data: company } = await admin
        .from("companies")
        .select("acuity_user_id, acuity_api_key, booking_provider")
        .eq("id", companyId).maybeSingle();
      if (!company || company.booking_provider !== "acuity" || !company.acuity_user_id || !company.acuity_api_key) {
        return json({ items: [] });
      }
      const minDate = body.min ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const maxDate = body.max ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const params = new URLSearchParams({
        minDate: minDate.slice(0, 10),
        maxDate: maxDate.slice(0, 10),
      });
      const basic = btoa(`${company.acuity_user_id}:${company.acuity_api_key}`);
      const res = await fetch(`https://acuityscheduling.com/api/v1/appointments?${params}`, {
        headers: { Authorization: `Basic ${basic}` },
      });
      const data = await res.json();
      if (!res.ok) return json({ error: data?.message ?? "Acuity fetch failed", items: [] }, 200);
      const items = (Array.isArray(data) ? data : []).map((a: any) => ({
        id: String(a.id),
        customer: [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email || "(no name)",
        service: a.type ?? "Appointment",
        startsAt: a.datetime,
        durationMin: Number(a.duration ?? 30),
        status: a.canceled ? "cancelled" : undefined,
        phone: a.phone ?? null,
      }));
      return json({ items });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("company-booking error", msg);
    return json({ error: msg }, 500);
  }
});
