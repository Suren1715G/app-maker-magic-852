// Cancel a booking on the active provider (Google Calendar or Acuity /
// Squarespace Scheduling) and notify the customer via SMS with a reschedule
// link.
//
// POST { provider: "google" | "acuity", eventId: string,
//        customerPhone?: string, customerName?: string,
//        startsAt?: string, calendarId?: string }
//
// Auth: caller must be a company_admin of the company that owns the booking.
// Returns: { ok: true, sms: { sent: boolean, error?: string, to?: string } }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

async function refreshGoogleToken(admin: any, row: any): Promise<string> {
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt > Date.now() + 30_000) return row.access_token;
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);
  const newAccess = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 3600;
  const newExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
  await admin
    .from("user_google_tokens")
    .update({ access_token: newAccess, expires_at: newExpiresAt })
    .eq("user_id", row.user_id);
  return newAccess;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  return null;
}

async function sendSms(opts: { from: string; to: string; body: string }) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    throw new Error("Twilio not configured (missing keys)");
  }
  const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: opts.from, To: opts.to, Body: opts.body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? `Twilio error ${res.status}`);
  }
  return data;
}

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
    const provider = String(body.provider ?? "").toLowerCase();
    const eventId = String(body.eventId ?? "").trim();
    if (!provider || !eventId) return json({ error: "provider and eventId required" }, 400);

    const { data: company } = await admin
      .from("companies")
      .select(
        "name, booking_provider, shared_calendar_id, shared_calendar_owner_user_id, " +
        "acuity_user_id, acuity_api_key, acuity_scheduling_url, calendly_scheduling_url",
      )
      .eq("id", companyId).maybeSingle();
    if (!company) return json({ error: "Company not found" }, 404);

    // ---- Cancel on the provider ----
    if (provider === "google") {
      // Determine which calendar + owner tokens to use
      let calendarId = body.calendarId as string | undefined;
      let ownerUserId: string | null = null;
      if (company.shared_calendar_id && company.shared_calendar_owner_user_id) {
        calendarId = calendarId || company.shared_calendar_id;
        ownerUserId = company.shared_calendar_owner_user_id;
      } else {
        // fall back to caller's own Google connection on their primary calendar
        ownerUserId = u.user.id;
        calendarId = calendarId || "primary";
      }
      const { data: tokenRow } = await admin
        .from("user_google_tokens").select("*").eq("user_id", ownerUserId).maybeSingle();
      if (!tokenRow) return json({ error: "Google not connected" }, 400);
      const accessToken = await refreshGoogleToken(admin, tokenRow);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId!)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        const txt = await res.text();
        return json({ error: `Google cancel failed [${res.status}]: ${txt}` }, 502);
      }
    } else if (provider === "acuity") {
      if (!company.acuity_user_id || !company.acuity_api_key) {
        return json({ error: "Acuity not connected" }, 400);
      }
      const basic = btoa(`${company.acuity_user_id}:${company.acuity_api_key}`);
      const res = await fetch(
        `https://acuityscheduling.com/api/v1/appointments/${encodeURIComponent(eventId)}/cancel?admin=true`,
        { method: "PUT", headers: { Authorization: `Basic ${basic}` } },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return json({ error: `Acuity cancel failed: ${data?.message ?? res.status}` }, 502);
      }
    } else {
      return json({ error: `Unsupported provider: ${provider}` }, 400);
    }

    // ---- Send SMS to the customer ----
    let smsResult: { sent: boolean; error?: string; to?: string } = { sent: false };
    const to = normalizePhone(body.customerPhone);
    if (!to) {
      smsResult = { sent: false, error: "No customer phone on file" };
    } else {
      // Build reschedule link
      const rescheduleUrl =
        provider === "acuity"
          ? company.acuity_scheduling_url
          : company.calendly_scheduling_url || null;

      // Pick a "From" number assigned to this company
      const { data: numbers } = await admin
        .from("company_phone_numbers")
        .select("phone_number")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);
      const from = numbers?.[0]?.phone_number ?? null;
      if (!from) {
        smsResult = { sent: false, error: "No active company phone number to send from" };
      } else {
        const name = String(body.customerName || "there").split(" ")[0];
        const startsAt = body.startsAt
          ? new Date(body.startsAt).toLocaleString(undefined, {
              weekday: "short", month: "short", day: "numeric",
              hour: "numeric", minute: "2-digit",
            })
          : null;
        const lines = [
          `Hi ${name}, your appointment with ${company.name}${startsAt ? ` on ${startsAt}` : ""} has been cancelled.`,
          rescheduleUrl
            ? `Reschedule here: ${rescheduleUrl}`
            : `Reply to this message and we'll help you reschedule.`,
        ];
        try {
          await sendSms({ from, to, body: lines.join(" ") });
          smsResult = { sent: true, to };
        } catch (e: any) {
          smsResult = { sent: false, to, error: e?.message ?? "SMS send failed" };
        }
      }
    }

    return json({ ok: true, sms: smsResult });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("cancel-booking error", msg);
    return json({ error: msg }, 500);
  }
});