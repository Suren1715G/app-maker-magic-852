// Receives Google's redirect, exchanges code for tokens, stores per-user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_FALLBACK = "https://app-maker-magic-852.lovable.app/calendar";

function redirectResponse(returnTo: string, status: "success" | "error", message: string) {
  let target = returnTo || APP_FALLBACK;
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
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  let returnTo = "/calendar";
  let userId: string | null = null;

  try {
    if (stateRaw) {
      const decoded = JSON.parse(atob(stateRaw));
      returnTo = decoded.r ?? "/calendar";
      userId = decoded.u ?? null;
    }

    if (errorParam) {
      return htmlResponse("Connection cancelled", `Google returned: ${errorParam}`, returnTo, false);
    }
    if (!code || !userId) throw new Error("Missing code or state");

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!clientId || !clientSecret) throw new Error("Google OAuth secrets not configured");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env not configured");

    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    const admin = createClient(supabaseUrl, serviceKey);

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
    if (!tokenRes.ok) {
      // If the code was already consumed (browser prefetch / double-fire) but
      // we already have valid tokens for this user, treat it as success.
      if (tokenJson?.error === "invalid_grant") {
        const { data: existing } = await admin
          .from("user_google_tokens")
          .select("google_email, expires_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (existing && new Date(existing.expires_at).getTime() > Date.now() - 5 * 60_000) {
          return htmlResponse(
            "Google Calendar connected",
            existing.google_email ? `Linked ${existing.google_email}` : "All set.",
            returnTo,
            true,
          );
        }
      }
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenJson)}`);
    }

    const accessToken: string = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number = tokenJson.expires_in ?? 3600;
    const scope: string = tokenJson.scope ?? "";

    if (!refreshToken) {
      // Existing connection? Reuse stored refresh token.
      // Otherwise we can't refresh later — instruct user to revoke + retry.
    }

    // Fetch user email
    let googleEmail: string | null = null;
    try {
      const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        googleEmail = info.email ?? null;
      }
    } catch (_) { /* ignore */ }

    const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

    // If no refresh token returned, try to keep existing one
    let finalRefresh = refreshToken;
    if (!finalRefresh) {
      const { data: existing } = await admin
        .from("user_google_tokens")
        .select("refresh_token")
        .eq("user_id", userId)
        .maybeSingle();
      finalRefresh = existing?.refresh_token;
    }
    if (!finalRefresh) {
      return htmlResponse(
        "Reconnect needed",
        "Google didn't return a refresh token. Please revoke access at myaccount.google.com/permissions and try again.",
        returnTo,
        false,
      );
    }

    const { error: upsertErr } = await admin
      .from("user_google_tokens")
      .upsert(
        {
          user_id: userId,
          google_email: googleEmail,
          access_token: accessToken,
          refresh_token: finalRefresh,
          expires_at: expiresAt,
          scope,
        },
        { onConflict: "user_id" },
      );
    if (upsertErr) throw new Error(`Failed to store tokens: ${upsertErr.message}`);

    return htmlResponse("Google Calendar connected", googleEmail ? `Linked ${googleEmail}` : "All set.", returnTo, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("oauth-callback error", msg);
    return htmlResponse("Connection failed", msg, returnTo, false);
  }
});