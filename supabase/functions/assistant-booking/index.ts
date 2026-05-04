// Unified booking tool for the AI receptionist.
//
// Routing is STRICT PER-LINE: every request must resolve to a specific
// phone line (location). The booking goes to that line's configured
// calendar (Google or Acuity). If the line has no booking integration
// set up, the call fails with `not_configured_for_this_line` — there is
// NO company-level fallback.
//
// The line is resolved from (in priority order):
//   1. body.line_id              (uuid of company_phone_numbers.id)
//   2. body.to_number            (the number the customer dialed)
//   3. body.call_id              (look up calls.to_number, then resolve)
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

type LineConfig = {
  line_id: string;
  company_id: string;
  provider: "none" | "google" | "acuity";
  calendar_id: string | null;
  calendar_summary: string | null;
  owner_user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  acuity_user_id: string | null;
  acuity_api_key: string | null;
  acuity_appointment_type_id: string | null;
  acuity_scheduling_url: string | null;
  business_hours_timezone: string | null;
};

async function resolveLine(
  admin: any,
  company_id: string,
  body: any,
): Promise<{ ok: true; line: LineConfig } | { ok: false; error: string; status?: number }> {
  let line_id: string | null = body?.line_id ? String(body.line_id) : null;

  // 2. to_number → line_id
  if (!line_id && body?.to_number) {
    const to = normalizePhone(String(body.to_number));
    if (to) {
      const { data } = await admin
        .from("company_phone_numbers")
        .select("id")
        .eq("company_id", company_id)
        .eq("phone_number", to)
        .maybeSingle();
      if (data?.id) line_id = data.id;
    }
  }

  // 3. call_id → calls.to_number → line_id
  if (!line_id && body?.call_id) {
    const { data: call } = await admin
      .from("calls")
      .select("to_number")
      .eq("id", String(body.call_id))
      .eq("company_id", company_id)
      .maybeSingle();
    if (call?.to_number) {
      const { data: pn } = await admin
        .from("company_phone_numbers")
        .select("id")
        .eq("company_id", company_id)
        .eq("phone_number", call.to_number)
        .maybeSingle();
      if (pn?.id) line_id = pn.id;
    }
  }

  if (!line_id) {
    return {
      ok: false,
      error:
        "Could not determine which phone line this booking is for. Pass line_id, to_number (the number that was dialed), or call_id.",
      status: 400,
    };
  }

  const { data: rows, error } = await admin.rpc("get_line_booking_config", { _line_id: line_id });
  if (error) return { ok: false, error: error.message, status: 500 };
  const line = Array.isArray(rows) && rows.length > 0 ? (rows[0] as LineConfig) : null;
  if (!line) return { ok: false, error: "Line not found", status: 404 };
  if (line.company_id !== company_id) {
    return { ok: false, error: "Line does not belong to this company", status: 403 };
  }
  return { ok: true, line };
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
  line: LineConfig,
  startISO: string,
  endISO: string,
) {
  if (!line.access_token || !line.calendar_id || !line.owner_user_id) {
    return { ok: false, error: "Google Calendar not connected for this line." };
  }
  const tokenRow = {
    user_id: line.owner_user_id,
    access_token: line.access_token,
    refresh_token: line.refresh_token,
    expires_at: line.expires_at,
  };
  const accessToken = await googleRefresh(admin, tokenRow);
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: line.calendar_id }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Google freeBusy failed: ${JSON.stringify(data)}` };
  const busy = data?.calendars?.[line.calendar_id]?.busy ?? [];
  return { ok: true, provider: "google", busy };
}

async function googleBook(
  admin: any,
  line: LineConfig,
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
  if (!line.access_token || !line.calendar_id || !line.owner_user_id) {
    return { ok: false, error: "Google Calendar not connected for this line." };
  }
  const tokenRow = {
    user_id: line.owner_user_id,
    access_token: line.access_token,
    refresh_token: line.refresh_token,
    expires_at: line.expires_at,
  };
  const accessToken = await googleRefresh(admin, tokenRow);

  const tz = line.business_hours_timezone || "America/New_York";
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
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(line.calendar_id)}/events`,
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

// ---------- Acuity ----------
function acuityAuthHeader(line: LineConfig) {
  const creds = `${line.acuity_user_id}:${line.acuity_api_key}`;
  return `Basic ${btoa(creds)}`;
}

async function acuityCheckAvailability(line: LineConfig, startISO: string) {
  if (!line.acuity_user_id || !line.acuity_api_key || !line.acuity_appointment_type_id) {
    return { ok: false, error: "Acuity not configured for this line." };
  }
  const date = startISO.slice(0, 10); // YYYY-MM-DD
  const params = new URLSearchParams({
    appointmentTypeID: line.acuity_appointment_type_id,
    date,
  });
  const res = await fetch(
    `https://acuityscheduling.com/api/v1/availability/times?${params}`,
    { headers: { Authorization: acuityAuthHeader(line) } },
  );
  const data = await res.json();
  if (!res.ok) return { ok: false, error: `Acuity error: ${JSON.stringify(data)}` };
  const slots = (Array.isArray(data) ? data : []).map((s: any) => ({ time: s.time }));
  return { ok: true, provider: "acuity", slots };
}

async function acuityBook(line: LineConfig, args: {
  startISO: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}) {
  if (!line.acuity_user_id || !line.acuity_api_key || !line.acuity_appointment_type_id) {
    return { ok: false, error: "Acuity not configured for this line." };
  }
  if (!args.customer_email) {
    return { ok: false, error: "Acuity requires a customer email to book." };
  }
  const [firstName, ...rest] = (args.customer_name ?? "Customer").split(" ");
  const lastName = rest.join(" ") || "—";
  const payload = {
    datetime: args.startISO,
    appointmentTypeID: Number(line.acuity_appointment_type_id),
    firstName,
    lastName,
    email: args.customer_email,
    phone: args.customer_phone ?? "",
  };
  const res = await fetch("https://acuityscheduling.com/api/v1/appointments", {
    method: "POST",
    headers: {
      Authorization: acuityAuthHeader(line),
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
      .select("id")
      .eq("id", company_id)
      .maybeSingle();
    if (!company) return json({ error: "Unknown company" }, 404);

    const resolved = await resolveLine(admin, company_id, body);
    if (!resolved.ok) return json({ ok: false, error: resolved.error }, resolved.status ?? 400);
    const line = resolved.line;
    const provider = line.provider;

    if (action === "get_provider") {
      const configured =
        provider === "google"
          ? Boolean(line.calendar_id && line.owner_user_id && line.access_token)
          : provider === "acuity"
            ? Boolean(line.acuity_user_id && line.acuity_api_key && line.acuity_appointment_type_id)
            : false;
      return json({
        provider,
        configured,
        line_id: line.line_id,
        calendar_summary: provider === "google" ? line.calendar_summary : null,
        scheduling_url: provider === "acuity" ? line.acuity_scheduling_url : null,
        error: provider === "none"
          ? "This phone line has no booking integration set up. Configure it in Settings → Locations."
          : !configured
            ? `This phone line is set to ${provider} but is missing credentials.`
            : undefined,
      });
    }

    if (provider === "none") {
      return json({
        ok: false,
        error: "not_configured_for_this_line",
        message:
          "This phone line has no booking integration set up. The owner needs to connect a calendar in Settings → Locations.",
      }, 200);
    }

    if (action === "check_availability") {
      const startISO = String(body?.start_time ?? "").trim();
      const endISO = String(body?.end_time ?? "").trim();
      if (!startISO) return json({ error: "start_time (ISO 8601) is required" }, 400);
      const computedEnd = endISO || new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
      if (provider === "google") return json(await googleCheckAvailability(admin, line, startISO, computedEnd));
      if (provider === "acuity") return json(await acuityCheckAvailability(line, startISO));
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
          preview: `Book "${summary}" on ${startISO} for ${durationMin} min via ${provider} (line ${line.line_id})` +
            (customer_name ? ` for ${customer_name}` : "") +
            (customer_phone ? ` (${customer_phone})` : "") + ".",
          requires_confirmation: true,
          provider,
        });
      }

      if (provider === "google") {
        return json(await googleBook(admin, line, {
          startISO, endISO, summary, description, customer_name, customer_email, customer_phone,
        }));
      }
      if (provider === "acuity") {
        return json(await acuityBook(line, {
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
