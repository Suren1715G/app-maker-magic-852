// Receives Google's redirect for the admin-initiated flow, exchanges the
// code, picks the user's primary calendar (or first writable one), and
// stores everything against the target company via admin_save_company_google_tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function htmlResponse(title: string, message: string, returnTo: string, ok: boolean) {
  const url = returnTo || "/master/companies";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#0b0b0c;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}
.card{background:#161618;border:1px solid #2a2a2e;border-radius:16px;padding:32px;max-width:460px}
h1{font-size:20px;margin:0 0 8px}p{color:#aaa;margin:0 0 16px}a{color:#7aa2ff}</style></head>
<body><div class="card"><h1>${ok ? "✓ " : "⚠ "}${title}</h1><p>${message}</p>
<p>You can close this window.</p>
<script>setTimeout(function(){window.location.href=${JSON.stringify(url)};},1500);</script>
<a href="${url}">Return now</a></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  let returnTo = "/master/companies";
  let stateNonce: string | null = null;

  try {
    if (stateRaw) {
      const decoded = JSON.parse(atob(stateRaw));
      returnTo = decoded.r ?? returnTo;
      stateNonce = decoded.s ?? null;
    }

    if (errorParam) {
      return htmlResponse("Connection cancelled", `Google returned: ${errorParam}`, returnTo, false);
    }
    if (!code || !stateNonce) throw new Error("Missing code or state");

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!clientId || !clientSecret) throw new Error("Google OAuth secrets not configured");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env not configured");

    const admin = createClient(supabaseUrl, serviceKey);

    // Look up pending flow
    const { data: pending, error: pErr } = await admin
      .from("pending_admin_google_oauth")
      .select("*")
      .eq("state", stateNonce)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pending) throw new Error("Unknown or expired admin OAuth flow");
    if (pending.consumed_at) throw new Error("OAuth flow already used");
    if (new Date(pending.expires_at).getTime() < Date.now()) {
      throw new Error("OAuth flow expired, please retry");
    }
    const companyId = pending.company_id as string;

    // Exchange code
    const redirectUri = `${supabaseUrl}/functions/v1/admin-google-oauth-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenJson)}`);

    const accessToken: string = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number = tokenJson.expires_in ?? 3600;
    const scope: string = tokenJson.scope ?? "";

    if (!refreshToken) {
      return htmlResponse(
        "Reconnect needed",
        "Google didn't return a refresh token. Have the client revoke access at myaccount.google.com/permissions and try again.",
        returnTo,
        false,
      );
    }

    // Get user email
    let googleEmail: string | null = null;
    try {
      const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) googleEmail = (await r.json()).email ?? null;
    } catch (_) { /* ignore */ }

    // Pick primary calendar (or first writable)
    let calendarId = "primary";
    let calendarSummary = googleEmail ?? "Primary";
    try {
      const r = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&maxResults=50",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (r.ok) {
        const list = await r.json();
        const items = (list.items ?? []) as any[];
        const primary = items.find((c) => c.primary) ?? items[0];
        if (primary) {
          calendarId = primary.id;
          calendarSummary = primary.summary ?? calendarSummary;
        }
      }
    } catch (_) { /* fall through with defaults */ }

    const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

    const { error: rpcErr } = await admin.rpc("admin_save_company_google_tokens", {
      _company_id: companyId,
      _google_email: googleEmail,
      _access_token: accessToken,
      _refresh_token: refreshToken,
      _expires_at: expiresAt,
      _scope: scope,
      _calendar_id: calendarId,
      _calendar_summary: calendarSummary,
    });
    if (rpcErr) throw new Error(`Failed to save tokens: ${rpcErr.message}`);

    await admin
      .from("pending_admin_google_oauth")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state", stateNonce);

    return htmlResponse(
      "Google Calendar connected",
      googleEmail ? `Linked ${googleEmail} (${calendarSummary})` : "Connected.",
      returnTo,
      true,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("admin-google-oauth-callback error", msg);
    return htmlResponse("Connection failed", msg, returnTo, false);
  }
});