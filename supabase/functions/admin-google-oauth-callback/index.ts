// Receives Google's redirect for the admin-initiated flow, exchanges the
// code, picks the user's primary calendar (or first writable one), and
// stores everything against the target company via admin_save_company_google_tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const APP_FALLBACK = "https://app-maker-magic-852.lovable.app/master/companies";

function redirectResponse(returnTo: string, status: "success" | "error", message: string) {
  let target = returnTo || APP_FALLBACK;
  // Ensure absolute URL; if a relative path slipped through, prepend the app origin.
  if (!/^https?:\/\//i.test(target)) {
    const base = new URL(APP_FALLBACK);
    target = `${base.origin}${target.startsWith("/") ? "" : "/"}${target}`;
  }
  try {
    const u = new URL(target);
    u.searchParams.set("google", status);
    if (message) u.searchParams.set("google_msg", message);
    target = u.toString();
  } catch (_) {
    // leave target as-is
  }
  return new Response(null, { status: 302, headers: { Location: target } });
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
      return redirectResponse(returnTo, "error", `Google returned: ${errorParam}`);
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
      return redirectResponse(
        returnTo,
        "error",
        "No refresh token returned. Revoke access at myaccount.google.com/permissions and retry.",
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

    return redirectResponse(
      returnTo,
      "success",
      googleEmail ? `Linked ${googleEmail}` : "Connected",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("admin-google-oauth-callback error", msg);
    return redirectResponse(returnTo, "error", msg);
  }
});