// Referral webhook: called by sgsaireception.com when a new customer signs up.
// POST { referrer_code, referred_email, referred_name?, status? }
// Header: x-webhook-secret: <REFERRAL_WEBHOOK_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const secret = Deno.env.get("REFERRAL_WEBHOOK_SECRET");
  if (!secret) return json(500, { error: "Webhook secret not configured" });

  const provided = req.headers.get("x-webhook-secret");
  if (provided !== secret) return json(401, { error: "Invalid webhook secret" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const referrerCode = String(payload?.referrer_code ?? "").trim().toUpperCase();
  const referredEmail = String(payload?.referred_email ?? "").trim().toLowerCase();
  const referredName = payload?.referred_name ? String(payload.referred_name).trim() : null;
  const status = ["pending", "qualified"].includes(payload?.status) ? payload.status : "pending";

  if (!referrerCode) return json(400, { error: "referrer_code is required" });
  if (!referredEmail || !referredEmail.includes("@"))
    return json(400, { error: "referred_email is required and must be a valid email" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up the referrer by their referral code.
  const { data: codeRow, error: codeErr } = await supabase
    .from("referral_codes")
    .select("user_id, code")
    .eq("code", referrerCode)
    .maybeSingle();

  if (codeErr) return json(500, { error: "Lookup failed", detail: codeErr.message });
  if (!codeRow) return json(404, { error: "Unknown referrer_code" });

  // We don't have a real auth user for the referred person yet (signup happens
  // on the website, not in Cloud). Use a deterministic UUID derived from email
  // so duplicate webhook calls for the same email don't double-credit.
  const enc = new TextEncoder().encode(`referral:${referredEmail}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc));
  // Format first 16 bytes as a UUID v4-ish string.
  const hex = Array.from(hash.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const referredUserId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;

  const { data: existing } = await supabase
    .from("referrals")
    .select("id, status")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existing) {
    // Allow upgrading pending -> qualified.
    if (existing.status !== "qualified" && status === "qualified") {
      const { error: upErr } = await supabase
        .from("referrals")
        .update({ status: "qualified", qualified_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (upErr) return json(500, { error: "Update failed", detail: upErr.message });
      return json(200, { ok: true, action: "qualified", referral_id: existing.id });
    }
    return json(200, { ok: true, action: "noop", referral_id: existing.id });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("referrals")
    .insert({
      referrer_user_id: codeRow.user_id,
      referred_user_id: referredUserId,
      referral_code: referrerCode,
      status,
      qualified_at: status === "qualified" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (insErr) return json(500, { error: "Insert failed", detail: insErr.message });

  // Best-effort notification to the referrer's company.
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", codeRow.user_id)
    .maybeSingle();

  if (profile?.company_id) {
    await supabase.from("notifications").insert({
      company_id: profile.company_id,
      user_id: codeRow.user_id,
      type: "lead",
      title: status === "qualified" ? "Referral credited 🎉" : "New referral signup",
      body: referredName
        ? `${referredName} (${referredEmail}) signed up using your code.`
        : `${referredEmail} signed up using your code.`,
      link: "/referrals",
      metadata: { referral_id: inserted.id, referrer_code: referrerCode },
    });
  }

  return json(200, { ok: true, action: "created", referral_id: inserted.id });
});