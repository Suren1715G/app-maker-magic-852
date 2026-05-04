// Server-side Google Calendar proxy with auto token refresh.
//
// Each user connects their own Google account (tokens in user_google_tokens).
// Each company can additionally designate ONE shared "company calendar":
// a specific calendar inside the connecting user's Google account that the
// whole team reads/writes to. Backend transparently uses that owner's tokens
// for everyone in the company.
//
// Routes:
//   GET  ?action=status                          -> { connected, email, company:{...} }
//   GET  ?action=events&...                      -> upcoming events (company shared calendar if set)
//   POST { action:"create", event:{...} }        -> insert event (company shared calendar if set)
//   POST { action:"disconnect" }                 -> revoke + delete row
//   POST { action:"list_my_calendars" }          -> caller's own Google calendars (for the picker)
//   POST { action:"set_shared_calendar",
//          calendarId, calendarSummary }         -> mark this calendar as the company's shared one
//   POST { action:"clear_shared_calendar" }      -> unset the company shared calendar
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function refreshIfNeeded(admin: any, row: any) {
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
  if (!res.ok) {
    const err: any = new Error(`Refresh failed: ${JSON.stringify(data)}`);
    err.code = "reconnect_required";
    err.googleError = data;
    throw err;
  }

  const newAccess = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 3600;
  const newExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

  await admin
    .from("user_google_tokens")
    .update({ access_token: newAccess, expires_at: newExpiresAt })
    .eq("user_id", row.user_id);

  return newAccess;
}

async function fetchCalendarList(accessToken: string, minAccessRole?: string) {
  const items: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("showHidden", "true");
    if (minAccessRole) url.searchParams.set("minAccessRole", minAccessRole);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, status: res.status, data };

    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { ok: true as const, items };
}

function googleApiMessage(data: any) {
  return data?.error?.message ?? data?.error?.error?.message ?? data?.message ?? null;
}

function calendarListErrorResponse(list: any) {
  const googleMessage = googleApiMessage(list.data);
  const needsReconnect =
    list.status === 401 ||
    list.status === 403 ||
    /insufficient authentication scopes|invalid_grant|unauthorized|forbidden/i.test(googleMessage ?? "");

  if (needsReconnect) {
    return json({
      error: "reconnect_required",
      message:
        "Google needs to be reconnected for this line so calendar permissions can be refreshed.",
    });
  }

  return json({ error: "google_calendar_error", message: googleMessage ?? "Failed to load calendars" }, list.status);
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
    const userId = u.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "";
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* */ }
      action = body.action ?? action;
    }

    // Caller's own Google connection (may be null)
    const { data: row } = await admin
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Caller's company + shared-calendar info (may be null)
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    const companyId = profile?.company_id ?? null;

    let companyShared:
      | {
          calendar_id: string | null;
          calendar_summary: string | null;
          owner_user_id: string | null;
          owner_email: string | null;
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
        }
      | null = null;
    if (companyId) {
      const { data: companyRow } = await admin.rpc(
        "get_company_calendar_connection",
        { _company_id: companyId },
      );
      if (Array.isArray(companyRow) && companyRow.length > 0) {
        companyShared = companyRow[0];
      }
    }

    const sharedCalendarId = companyShared?.calendar_id ?? null;
    const sharedOwnerUserId = companyShared?.owner_user_id ?? null;
    const sharedConfigured = Boolean(sharedCalendarId && sharedOwnerUserId);

    if (action === "status") {
      return json({
        connected: !!row,
        email: row?.google_email ?? null,
        company: companyId
          ? {
              shared_configured: sharedConfigured,
              calendar_id: sharedCalendarId,
              calendar_summary: companyShared?.calendar_summary ?? null,
              owner_email: companyShared?.owner_email ?? null,
              is_owner: sharedOwnerUserId === userId,
              owner_token_present: Boolean(companyShared?.access_token),
            }
          : null,
      });
    }

    if (action === "list_my_calendars") {
      if (!row) return json({ error: "not_connected" }, 400);
      const accessToken = await refreshIfNeeded(admin, row);
      const list = await fetchCalendarList(accessToken);
      if (!list.ok) return calendarListErrorResponse(list);
      const items = list.items.map((c: any) => ({
        id: c.id,
        summary: c.summary,
        primary: !!c.primary,
        accessRole: c.accessRole,
      }));
      return json({ items });
    }

    // List calendars for a specific phone line's connected Google account.
    // Authorized if caller is global admin OR a member of the line's company.
    // Uses the owner's stored tokens (owner_user_id can be a real user id or
    // the synthetic line_id used by admin-connected lines).
    if (action === "list_line_calendars") {
      const lineId = body.line_id as string | undefined;
      if (!lineId) return json({ error: "Missing line_id" }, 400);

      const { data: line } = await admin
        .from("company_phone_numbers")
        .select("company_id, shared_calendar_owner_user_id")
        .eq("id", lineId)
        .maybeSingle();
      if (!line) return json({ error: "line_not_found" }, 404);

      // Authz
      const { data: roles } = await admin
        .from("user_roles").select("role").eq("user_id", userId);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      const inCompany = profile?.company_id === line.company_id;
      if (!isAdmin && !inCompany) return json({ error: "forbidden" }, 403);

      const ownerId = line.shared_calendar_owner_user_id;
      if (!ownerId) return json({ error: "no_owner" }, 400);

      const { data: ownerRow } = await admin
        .from("user_google_tokens")
        .select("*")
        .eq("user_id", ownerId)
        .maybeSingle();
      if (!ownerRow) return json({ error: "owner_not_connected" }, 400);

      const accessToken = await refreshIfNeeded(admin, ownerRow);
      const list = await fetchCalendarList(accessToken);
      if (!list.ok) return calendarListErrorResponse(list);
      const items = list.items.map((c: any) => ({
        id: c.id,
        summary: c.summary,
        primary: !!c.primary,
        accessRole: c.accessRole,
      }));
      return json({ items, owner_user_id: ownerId });
    }

    if (action === "set_shared_calendar") {
      if (!companyId) return json({ error: "no_company" }, 400);
      if (!row) return json({ error: "not_connected" }, 400);
      const calendarId = body.calendarId as string | undefined;
      const calendarSummary = (body.calendarSummary as string | undefined) ?? null;
      if (!calendarId) return json({ error: "Missing calendarId" }, 400);
      const { error: upErr } = await admin
        .from("companies")
        .update({
          shared_calendar_id: calendarId,
          shared_calendar_summary: calendarSummary,
          shared_calendar_owner_user_id: userId,
        })
        .eq("id", companyId);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true });
    }

    if (action === "clear_shared_calendar") {
      if (!companyId) return json({ error: "no_company" }, 400);
      const { error: upErr } = await admin
        .from("companies")
        .update({
          shared_calendar_id: null,
          shared_calendar_summary: null,
          shared_calendar_owner_user_id: null,
        })
        .eq("id", companyId);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true });
    }

    if (action === "disconnect") {
      if (!row) return json({ error: "not_connected" }, 400);
      // If this user is the company calendar owner, also clear it so the team
      // doesn't keep pointing at a calendar with no working tokens.
      if (companyId && sharedOwnerUserId === userId) {
        await admin
          .from("companies")
          .update({
            shared_calendar_id: null,
            shared_calendar_summary: null,
            shared_calendar_owner_user_id: null,
          })
          .eq("id", companyId);
      }
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${row.refresh_token}`, { method: "POST" });
      } catch (_) { /* ignore */ }
      await admin.from("user_google_tokens").delete().eq("user_id", userId);
      return json({ ok: true });
    }

    // For events/create we prefer the company shared calendar (using the owner's
    // tokens). If no shared calendar is set, fall back to the caller's own
    // primary calendar — which requires the caller to be connected.
    let accessToken: string;
    let effectiveCalendarId: string;
    if (sharedConfigured && companyShared?.access_token && companyShared.refresh_token && companyShared.expires_at) {
      const ownerRow = {
        user_id: sharedOwnerUserId!,
        access_token: companyShared.access_token,
        refresh_token: companyShared.refresh_token,
        expires_at: companyShared.expires_at,
      };
      accessToken = await refreshIfNeeded(admin, ownerRow);
      effectiveCalendarId = sharedCalendarId!;
    } else {
      if (!row) return json({ error: "not_connected" }, 400);
      accessToken = await refreshIfNeeded(admin, row);
      effectiveCalendarId = "primary";
    }

    if (action === "events") {
      const calendarId = url.searchParams.get("calendarId") ?? effectiveCalendarId;
      const timeMin = url.searchParams.get("timeMin") ?? new Date().toISOString();
      const timeMax = url.searchParams.get("timeMax") ?? undefined;
      const maxResults = url.searchParams.get("maxResults") ?? "50";
      const params = new URLSearchParams({
        timeMin,
        maxResults,
        singleEvents: "true",
        orderBy: "startTime",
      });
      if (timeMax) params.set("timeMax", timeMax);

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await res.json();
      if (!res.ok) return json({ error: data }, res.status);
      return json({ items: data.items ?? [] });
    }

    if (action === "create") {
      const event = body.event;
      const calendarId = body.calendarId ?? effectiveCalendarId;
      if (!event) return json({ error: "Missing event" }, 400);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );
      const data = await res.json();
      if (!res.ok) return json({ error: data }, res.status);
      return json({ event: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const code = (err as any)?.code;
    console.error("google-calendar error", msg);
    if (code === "reconnect_required") {
      return json(
        {
          error: "reconnect_required",
          message:
            "Google connection expired or was revoked. Please reconnect the Google account for this line.",
        },
      );
    }
    return json({ error: msg }, 500);
  }
});