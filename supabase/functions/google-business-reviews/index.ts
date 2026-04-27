// Google Business Profile reviews integration.
// Actions (POST JSON): { action, company_id?, ...args }
//   list_locations          -> Lists Business Profile accounts + locations the connected user owns.
//   set_location            -> Saves the chosen account/location on the company.
//   sync                    -> Pulls latest reviews from Google into the reviews table.
//   reply { review_id, text } -> Posts/updates a reply on Google + saves locally.
//   delete_reply { review_id } -> Removes a reply on Google + locally.
//   disconnect              -> Clears the company's Google Business linkage.
//
// Authorization: caller must be a member of the target company OR a global admin.
// Owner OAuth token is read from companies.google_business_owner_user_id ->
// user_google_tokens (refreshed if expired).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshIfNeeded(admin: ReturnType<typeof createClient>, ownerUserId: string) {
  const { data: tok, error } = await admin
    .from("user_google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  if (!tok) throw new Error("Owner has not connected Google");

  const expiresAt = tok.expires_at ? new Date(tok.expires_at as string).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) return tok.access_token as string;

  // Refresh
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: tok.refresh_token as string,
    grant_type: "refresh_token",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const j = await resp.json();
  if (!resp.ok) throw new Error(`Refresh failed: ${JSON.stringify(j)}`);
  const newAccess = j.access_token as string;
  const newExpiry = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("user_google_tokens")
    .update({ access_token: newAccess, expires_at: newExpiry })
    .eq("user_id", ownerUserId);
  return newAccess;
}

async function gfetch(url: string, accessToken: string, init: RequestInit = {}) {
  const resp = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await resp.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!resp.ok) {
    const msg = data?.error?.message || `HTTP ${resp.status}`;
    const err = new Error(`Google API: ${msg}`);
    (err as any).status = resp.status;
    (err as any).body = data;
    throw err;
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    if (!action) return json({ error: "Missing action" }, 400);

    // Resolve company_id (defaults to caller's company)
    let companyId: string | null = body.company_id ?? null;
    if (!companyId) {
      const { data: prof } = await admin
        .from("profiles")
        .select("company_id")
        .eq("user_id", callerId)
        .maybeSingle();
      companyId = prof?.company_id ?? null;
    }
    if (!companyId) return json({ error: "No company" }, 400);

    // Authorize: member of the company, or global admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    const { data: membership } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", callerId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!isAdmin && !membership) return json({ error: "Not authorized" }, 403);

    // Load company
    const { data: company, error: cErr } = await admin
      .from("companies")
      .select(
        "id, google_business_account_id, google_business_location_id, google_business_location_name, google_business_owner_user_id",
      )
      .eq("id", companyId)
      .maybeSingle();
    if (cErr || !company) return json({ error: "Company not found" }, 404);

    // Determine the owner whose Google token we should use:
    //   - existing linked owner if set,
    //   - otherwise the caller (used for list_locations / first set_location).
    const ownerUserId = company.google_business_owner_user_id ?? callerId;

    if (action === "disconnect") {
      await admin
        .from("companies")
        .update({
          google_business_account_id: null,
          google_business_location_id: null,
          google_business_location_name: null,
          google_business_owner_user_id: null,
        })
        .eq("id", companyId);
      return json({ ok: true });
    }

    const accessToken = await refreshIfNeeded(admin, ownerUserId);

    if (action === "list_locations") {
      // Step 1: list accounts (Account Management API)
      const accountsResp = await gfetch(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        accessToken,
      );
      const accounts = accountsResp.accounts ?? [];
      const out: Array<{ account: any; locations: any[] }> = [];
      for (const acc of accounts) {
        // Step 2: list locations for each account (Business Information API)
        const locResp = await gfetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,storefrontAddress`,
          accessToken,
        ).catch((e) => ({ locations: [], _error: e.message }));
        out.push({ account: acc, locations: locResp.locations ?? [] });
      }
      return json({ accounts: out });
    }

    if (action === "set_location") {
      const accountName: string = body.account_name; // e.g. "accounts/123"
      const locationName: string = body.location_name; // e.g. "locations/456"
      const displayName: string = body.display_name ?? "";
      if (!accountName || !locationName) {
        return json({ error: "account_name and location_name are required" }, 400);
      }
      await admin
        .from("companies")
        .update({
          google_business_account_id: accountName,
          google_business_location_id: locationName,
          google_business_location_name: displayName,
          google_business_owner_user_id: callerId,
        })
        .eq("id", companyId);
      return json({ ok: true });
    }

    // Below actions require a linked location
    if (!company.google_business_account_id || !company.google_business_location_id) {
      return json({ error: "No Google Business location linked" }, 400);
    }
    const accountName = company.google_business_account_id;
    const locationName = company.google_business_location_id;
    // mybusiness v4 reviews endpoint expects {accountName}/{locationName}/reviews
    const reviewsBase =
      `https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews`;

    if (action === "sync") {
      const reviewsResp = await gfetch(`${reviewsBase}?pageSize=50`, accessToken);
      const items = reviewsResp.reviews ?? [];
      const ratingMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
      const rows = items.map((r: any) => ({
        company_id: companyId,
        google_review_id: r.reviewId,
        reviewer_name: r.reviewer?.displayName ?? "Anonymous",
        reviewer_photo_url: r.reviewer?.profilePhotoUrl ?? null,
        rating: ratingMap[r.starRating] ?? 0,
        comment: r.comment ?? null,
        reply_text: r.reviewReply?.comment ?? null,
        reply_updated_at: r.reviewReply?.updateTime ?? null,
        posted_at: r.createTime ?? new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        source: "google",
      }));
      if (rows.length) {
        const { error } = await admin
          .from("reviews")
          .upsert(rows, { onConflict: "company_id,google_review_id" });
        if (error) throw new Error(`Save failed: ${error.message}`);
      }
      return json({ ok: true, synced: rows.length });
    }

    if (action === "reply") {
      const reviewLocalId: string = body.review_id;
      const text: string = body.text ?? "";
      if (!reviewLocalId || !text.trim()) {
        return json({ error: "review_id and text required" }, 400);
      }
      const { data: rev } = await admin
        .from("reviews")
        .select("id, google_review_id")
        .eq("id", reviewLocalId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!rev?.google_review_id) return json({ error: "Review not found" }, 404);

      const out = await gfetch(
        `${reviewsBase}/${rev.google_review_id}/reply`,
        accessToken,
        { method: "PUT", body: JSON.stringify({ comment: text }) },
      );
      await admin
        .from("reviews")
        .update({
          reply_text: out.comment ?? text,
          reply_updated_at: out.updateTime ?? new Date().toISOString(),
        })
        .eq("id", reviewLocalId);
      return json({ ok: true });
    }

    if (action === "delete_reply") {
      const reviewLocalId: string = body.review_id;
      const { data: rev } = await admin
        .from("reviews")
        .select("id, google_review_id")
        .eq("id", reviewLocalId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!rev?.google_review_id) return json({ error: "Review not found" }, 404);
      await gfetch(
        `${reviewsBase}/${rev.google_review_id}/reply`,
        accessToken,
        { method: "DELETE" },
      );
      await admin
        .from("reviews")
        .update({ reply_text: null, reply_updated_at: null })
        .eq("id", reviewLocalId);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("google-business-reviews error", e?.message, e?.body);
    return json(
      { error: e?.message ?? "unknown", details: e?.body ?? null },
      e?.status ?? 500,
    );
  }
});