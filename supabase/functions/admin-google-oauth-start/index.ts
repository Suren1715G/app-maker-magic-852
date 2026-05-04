// Admin-initiated Google OAuth: lets a workspace admin connect a Google
// account on behalf of a specific company (the admin signs in with the
// CLIENT'S Google credentials in the consent screen).
//
// Flow:
//   POST  { company_id, return_to } (admin JWT)
//     -> creates pending row with random state, returns Google auth URL.
//   Google redirects -> admin-google-oauth-callback (separate function).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase env not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Missing Authorization header");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) throw new Error("Not authenticated");
    const adminId = u.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id as string | undefined;
    const lineId = body.line_id as string | undefined;
    const returnTo = (body.return_to as string | undefined) ?? "/master/companies";
    if (!companyId) throw new Error("Missing company_id");

    const state = crypto.randomUUID() + "." + crypto.randomUUID();
    const { error: insErr } = await admin
      .from("pending_admin_google_oauth")
      .insert({
        state,
        admin_user_id: adminId,
        company_id: companyId,
        line_id: lineId ?? null,
      });
    if (insErr) throw new Error(`Failed to create pending flow: ${insErr.message}`);

    // We pack return_to inside state so callback can redirect cleanly.
    const stateParam = btoa(JSON.stringify({ s: state, r: returnTo }));

    const redirectUri = `${supabaseUrl}/functions/v1/admin-google-oauth-callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent select_account");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", stateParam);

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});