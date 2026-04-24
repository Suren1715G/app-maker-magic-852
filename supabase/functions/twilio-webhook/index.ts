// Twilio Voice status-callback webhook receiver.
// Configure on each Twilio number:
//   Voice & Fax -> A Call Comes In -> Webhook (or Status Callback)
//   URL: https://<project-ref>.supabase.co/functions/v1/twilio-webhook
//   Method: POST  (Twilio sends application/x-www-form-urlencoded)
//
// The number being called (`To` for inbound, `From` for outbound) maps to
// a company via the `company_phone_numbers` table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Twilio sends form-urlencoded
    const contentType = req.headers.get("content-type") ?? "";
    let params: Record<string, string> = {};
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      form.forEach((v, k) => (params[k] = v.toString()));
    } else {
      params = await req.json();
    }

    const callSid = params.CallSid;
    const direction = (params.Direction || "inbound").toLowerCase();
    const fromNumber = params.From;
    const toNumber = params.To;
    const callStatus = (params.CallStatus || "").toLowerCase();
    const recordingUrl = params.RecordingUrl
      ? `${params.RecordingUrl}.mp3`
      : null;
    const duration = parseInt(params.CallDuration ?? params.Duration ?? "0", 10);

    if (!callSid) {
      return new Response(
        JSON.stringify({ error: "Missing CallSid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Inbound: call rang our Twilio number `To`.
    // Outbound: call placed FROM our Twilio number `From`.
    const ourNumber = direction.startsWith("inbound") ? toNumber : fromNumber;
    const otherParty = direction.startsWith("inbound") ? fromNumber : toNumber;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: mapping } = await supabase
      .from("company_phone_numbers")
      .select("company_id")
      .eq("phone_number", ourNumber)
      .maybeSingle();

    if (!mapping?.company_id) {
      console.warn(`No company mapped for Twilio number ${ourNumber}`);
      // Reply with empty TwiML so Twilio doesn't error
      return new Response("<Response/>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    let status = "answered";
    if (["no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
      status = "missed-followup";
    }

    const { error } = await supabase.from("calls").upsert(
      {
        company_id: mapping.company_id,
        source: "twilio",
        external_id: callSid,
        caller: params.CallerName || otherParty || "Unknown caller",
        phone: otherParty,
        direction,
        status,
        duration_sec: duration,
        summary: `${direction === "inbound" ? "Incoming" : "Outgoing"} call ${
          status === "missed-followup" ? "(missed)" : "completed"
        }.`,
        recording_url: recordingUrl,
        metadata: { twilio: params },
        started_at: params.Timestamp
          ? new Date(params.Timestamp).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: "source,external_id" },
    );

    if (error) throw error;

    // Twilio expects TwiML for "Call Comes In" webhooks. An empty Response
    // is valid and lets Twilio continue with whatever it would do otherwise.
    return new Response("<Response/>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("twilio-webhook error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});