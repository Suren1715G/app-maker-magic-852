// Server-side Google Calendar proxy with auto token refresh.
// Routes:
//   GET  ?action=status         -> { connected, email }
//   GET  ?action=events&...     -> upcoming events (timeMin defaults to now)
//   POST { action:"create", event:{...} } -> insert event
//   POST { action:"disconnect" } -> revoke + delete row
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
  if (!res.ok) throw new Error(`Refresh failed: ${JSON.stringify(data)}`);

  const newAccess = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 3600;
  const newExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

  await admin
    .from("user_google_tokens")
    .update({ access_token: newAccess, expires_at: newExpiresAt })
    .eq("user_id", row.user_id);

  return newAccess;
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

    const { data: row } = await admin
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (action === "status") {
      return json({ connected: !!row, email: row?.google_email ?? null });
    }

    if (!row) return json({ error: "not_connected" }, 400);

    if (action === "disconnect") {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${row.refresh_token}`, { method: "POST" });
      } catch (_) { /* ignore */ }
      await admin.from("user_google_tokens").delete().eq("user_id", userId);
      return json({ ok: true });
    }

    const accessToken = await refreshIfNeeded(admin, row);

    if (action === "events") {
      const calendarId = url.searchParams.get("calendarId") ?? "primary";
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
      const calendarId = body.calendarId ?? "primary";
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
    console.error("google-calendar error", msg);
    return json({ error: msg }, 500);
  }
});