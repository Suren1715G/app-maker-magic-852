// Unified booking tool for the AI receptionist.
// Routes check_availability + book_appointment to the company's configured
// booking provider: Google Calendar, Calendly, or Acuity Scheduling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-assistant-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(p?: string | null) {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (p.startsWith("+")) return p;
  return digits ? `+${digits}` : null;
}

// ---------- Google ----------
async function googleRefresh(admin: any, row: any) {
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
  if (!res.ok) throw new Error(`Google refresh failed: ${JSON.stringify(data)}`);
  const newAccess = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 3600;
  const newExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
  await admin.from("user_google_tokens").update({
    access_token: newAccess,
    expires_at: newExpiresAt,
  }).eq("user_id", row.user_id);
  return newAccess;
}

async function googleCheckAvailability(
  admin: any,
  company: any,
  startISO: string,
  endISO: string,
) {
  const { data: rows } = await admin.rpc("get_company_calendar_connection", {
    _company_id: company.id,
  });
  const conn = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!conn?.access_token || !conn?.calendar_id) {
    return { ok: false, error: "Google Calendar not connected for this company." };
  }
  const tokenRow = {
    user_id: conn.owner_user_id,
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expires_at: conn.expires_at,
  };
  const accessToken = await googleRefresh(admin, tokenRow);
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: conn.calendar_id }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Google freeBusy failed: ${JSON.stringify(data)}` };
  const busy = data?.calendars?.[conn.calendar_id]?.busy ?? [];
  return { ok: true, provider: "google", busy };
}

async function googleBook(
  admin: any,
  company: any,
  args: {
    startISO: string;
    endISO: string;
    summary: string;
    description?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
  },
) {
  const { data: rows } = await admin.rpc("get_company_calendar_connection", {
    _company_id: company.id,
  });
  const conn = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!conn?.access_token || !conn?.calendar_id) {
    return { ok: false, error: "Google Calendar not connected for this company." };
  }
  const tokenRow = {
    user_id: conn.owner_user_id,
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expires_at: conn.expires_at,
  };
  const accessToken = await googleRefresh(admin, tokenRow);

  const tz = company.business_hours_timezone || "America/New_York";
  const descriptionLines = [
    args.description ?? "",
    args.customer_name ? `Customer: ${args.customer_name}` : "",
    args.customer_phone ? `Phone: ${args.customer_phone}` : "",
    args.customer_email ? `Email: ${args.customer_email}` : "",
    "Booked by AI receptionist.",
  ].filter(Boolean).join("\n");

  const event: Record<string, unknown> = {
    summary: args.summary,
    description: descriptionLines,
    start: { dateTime: args.startISO, timeZone: tz },
    end: { dateTime: args.endISO, timeZone: tz },
  };
  if (args.customer_email) {
    event.attendees = [{ email: args.customer_email, displayName: args.customer_name }];
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    },
  );
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Google create failed: ${JSON.stringify(data)}` };
  return {
    ok: true,
    provider: "google",
    event_id: data.id,
    html_link: data.htmlLink,
  };
}

// ---------- Calendly ----------
async function calendlyCheckAvailability(company: any, startISO: string, endISO: string) {
  if (!company.calendly_access_token || !company.calendly_event_type_uri) {
    return { ok: false, error: "Calendly not configured." };
  }
  const params = new URLSearchParams({
    event_type: company.calendly_event_type_uri,
    start_time: startISO,
    end_time: endISO,
  });
  const res = await fetch(`https://api.calendly.com/event_type_available_times?${params}`, {
    headers: { Authorization: `Bearer ${company.calendly_access_token}` },
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Calendly error: ${JSON.stringify(data)}` };
  const slots = (data?.collection ?? []).map((s: any) => ({
    start_time: s.start_time,
    scheduling_url: s.scheduling_url,
  }));
  return { ok: true, provider: "calendly", slots };
}

async function calendlyBook(company: any, args: {
  startISO: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}) {
  // Calendly's API does NOT allow creating bookings directly from a PAT.
  // Instead, we look up the available slot at startISO and return its
  // scheduling_url, then the AI texts the link to the customer.
  if (!company.calendly_access_token || !company.calendly_event_type_uri) {
    return { ok: false, error: "Calendly not configured." };
  }
  const start = new Date(args.startISO);
  const dayStart = new Date(start); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setUTCHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    event_type: company.calendly_event_type_uri,
    start_time: dayStart.toISOString(),
    end_time: dayEnd.toISOString(),
  });
  const res = await fetch(`https://api.calendly.com/event_type_available_times?${params}`, {
    headers: { Authorization: `Bearer ${company.calendly_access_token}` },
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Calendly lookup failed: ${JSON.stringify(data)}` };
  const slot = (data?.collection ?? []).find(
    (s: any) => Math.abs(new Date(s.start_time).getTime() - start.getTime()) < 60_000,
  );
  if (!slot) {
    return {
      ok: false,
      error: "That exact time is no longer available on Calendly.",
      scheduling_url: company.calendly_scheduling_url ?? null,
    };
  }
  return {
    ok: true,
    provider: "calendly",
    requires_customer_to_finalize: true,
    scheduling_url: slot.scheduling_url,
    instructions:
      "Calendly requires the customer to finalize the booking themselves. Send them this link via SMS to confirm.",
  };
}

// ---------- Acuity ----------
function acuityAuthHeader(company: any) {
  const creds = `${company.acuity_user_id}:${company.acuity_api_key}`;
  // base64
  const b64 = btoa(creds);
  return `Basic ${b64}`;
}

async function acuityCheckAvailability(company: any, startISO: string) {
  if (!company.acuity_user_id || !company.acuity_api_key || !company.acuity_appointment_type_id) {
    return { ok: false, error: "Acuity not configured." };
  }
  const date = startISO.slice(0, 10); // YYYY-MM-DD
  const params = new URLSearchParams({
    appointmentTypeID: company.acuity_appointment_type_id,
    date,
  });
  const res = await fetch(
    `https://acuityscheduling.com/api/v1/availability/times?${params}`,
    { headers: { Authorization: acuityAuthHeader(company) } },
  );
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Acuity error: ${JSON.stringify(data)}` };
  const slots = (Array.isArray(data) ? data : []).map((s: any) => ({ time: s.time }));
  return { ok: true, provider: "acuity", slots };
}

async function acuityBook(company: any, args: {
  startISO: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}) {
  if (!company.acuity_user_id || !company.acuity_api_key || !company.acuity_appointment_type_id) {
    return { ok: false, error: "Acuity not configured." };
  }
  if (!args.customer_email) {
    return { ok: false, error: "Acuity requires a customer email to book." };
  }
  const [firstName, ...rest] = (args.customer_name ?? "Customer").split(" ");
  const lastName = rest.join(" ") || "—";
  const payload = {
    datetime: args.startISO,
    appointmentTypeID: Number(company.acuity_appointment_type_id),
    firstName,
    lastName,
    email: args.customer_email,
    phone: args.customer_phone ?? "",
  };
  const res = await fetch("https://acuityscheduling.com/api/v1/appointments", {
    method: "POST",
    headers: {
      Authorization: acuityAuthHeader(company),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Acuity booking failed: ${JSON.stringify(data)}` };
  return {
    ok: true,
    provider: "acuity",
    appointment_id: data.id,
    confirmation_page: data.confirmationPage ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SHARED_SECRET = Deno.env.get("ASSISTANT_TOOL_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SHARED_SECRET) return json({ error: "Server misconfigured" }, 500);
    if (req.headers.get("x-assistant-secret") !== SHARED_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();
    const company_id = String(body?.company_id ?? "").trim();
    if (!company_id) return json({ error: "company_id is required" }, 400);
    if (!action) return json({ error: "action is required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: company } = await admin
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .maybeSingle();
    if (!company) return json({ error: "Unknown company" }, 404);

    const provider = company.booking_provider || "google";

    if (action === "get_provider") {
      return json({
        provider,
        configured:
          provider === "google"
            ? Boolean(company.shared_calendar_id && company.shared_calendar_owner_user_id)
            : provider === "calendly"
              ? Boolean(company.calendly_access_token && company.calendly_event_type_uri)
              : provider === "acuity"
                ? Boolean(company.acuity_user_id && company.acuity_api_key && company.acuity_appointment_type_id)
                : false,
        scheduling_url:
          provider === "calendly"
            ? company.calendly_scheduling_url
            : provider === "acuity"
              ? company.acuity_scheduling_url
              : null,
      });
    }

    if (action === "check_availability") {
      const startISO = String(body?.start_time ?? "").trim();
      const endISO = String(body?.end_time ?? "").trim();
      if (!startISO) return json({ error: "start_time (ISO 8601) is required" }, 400);
      const computedEnd = endISO || new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();

      if (provider === "google") return json(await googleCheckAvailability(admin, company, startISO, computedEnd));
      if (provider === "calendly") return json(await calendlyCheckAvailability(company, startISO, computedEnd));
      if (provider === "acuity") return json(await acuityCheckAvailability(company, startISO));
      return json({ ok: false, error: `Unknown provider: ${provider}` }, 400);
    }

    if (action === "book_appointment") {
      const startISO = String(body?.start_time ?? "").trim();
      const durationMin = Number(body?.duration_minutes ?? 60);
      const summary = String(body?.summary ?? "Appointment").trim();
      const description = body?.description ? String(body.description) : undefined;
      const customer_name = body?.customer_name ? String(body.customer_name) : undefined;
      const customer_email = body?.customer_email ? String(body.customer_email) : undefined;
      const customer_phone = normalizePhone(body?.customer_phone) ?? undefined;
      const confirmed = body?.confirmed === true || body?.confirmed === "true";

      if (!startISO) return json({ error: "start_time (ISO 8601) is required" }, 400);
      const endISO = new Date(new Date(startISO).getTime() + durationMin * 60_000).toISOString();

      if (!confirmed) {
        return json({
          preview: `Book "${summary}" on ${startISO} for ${durationMin} min via ${provider}` +
            (customer_name ? ` for ${customer_name}` : "") +
            (customer_phone ? ` (${customer_phone})` : "") + ".",
          requires_confirmation: true,
          provider,
        });
      }

      if (provider === "google") {
        return json(await googleBook(admin, company, {
          startISO, endISO, summary, description, customer_name, customer_email, customer_phone,
        }));
      }
      if (provider === "calendly") {
        return json(await calendlyBook(company, {
          startISO, customer_name, customer_email, customer_phone,
        }));
      }
      if (provider === "acuity") {
        return json(await acuityBook(company, {
          startISO, customer_name, customer_email, customer_phone,
        }));
      }
      return json({ ok: false, error: `Unknown provider: ${provider}` }, 400);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("assistant-booking error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
