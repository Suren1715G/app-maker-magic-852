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

// Returns true if the given moment falls inside [open, close) in the given
// IANA timezone. Same-day window only (e.g. 08:00 → 18:00, not overnight).
function isInsideBusinessHours(opts: {
  at: Date;
  open: string; // "HH:MM" or "HH:MM:SS"
  close: string;
  timezone: string;
}): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: opts.timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(opts.at);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const nowMin = hh * 60 + mm;
    const [oH, oM] = opts.open.split(":").map(Number);
    const [cH, cM] = opts.close.split(":").map(Number);
    const openMin = oH * 60 + (oM || 0);
    const closeMin = cH * 60 + (cM || 0);
    if (closeMin <= openMin) {
      // Overnight window (e.g. 22:00 → 06:00) — true if before close OR after open.
      return nowMin >= openMin || nowMin < closeMin;
    }
    return nowMin >= openMin && nowMin < closeMin;
  } catch (_e) {
    // If anything blows up (bad timezone string, etc.), default to "open"
    // rather than dropping the call.
    return true;
  }
}

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

    const messageSid = params.MessageSid || params.SmsSid;
    const callSid = params.CallSid;
    const direction = (params.Direction || "inbound").toLowerCase();
    const fromNumber = params.From;
    const toNumber = params.To;
    const messageBody = params.Body || "";
    const callStatus = (params.CallStatus || "").toLowerCase();
    const recordingUrl = params.RecordingUrl
      ? `${params.RecordingUrl}.mp3`
      : null;
    const duration = parseInt(params.CallDuration ?? params.Duration ?? "0", 10);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (messageSid) {
      const isInbound = !direction.includes("outbound");
      const ourNumber = isInbound ? toNumber : fromNumber;
      const otherParty = isInbound ? fromNumber : toNumber;

      const { data: mapping } = await supabase
        .from("company_phone_numbers")
        .select("company_id")
        .eq("phone_number", ourNumber)
        .maybeSingle();

      if (!mapping?.company_id) {
        console.warn(`No company mapped for Twilio SMS number ${ourNumber}`);
        return new Response("<Response/>", {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }

      const sentAt = params.DateSent ? new Date(params.DateSent).toISOString() : new Date().toISOString();
      const delivered = !["failed", "undelivered"].includes((params.MessageStatus || params.SmsStatus || "").toLowerCase());
      const { data: thread, error: threadError } = await supabase
        .from("sms_threads")
        .upsert(
          {
            company_id: mapping.company_id,
            phone: otherParty,
            customer: params.ProfileName || otherParty || "Unknown customer",
            unread: isInbound ? 1 : 0,
            last_message_at: sentAt,
          },
          { onConflict: "company_id,phone" },
        )
        .select("id")
        .single();
      if (threadError) throw threadError;

      const { error: messageError } = await supabase.from("sms_messages").upsert(
        {
          company_id: mapping.company_id,
          thread_id: thread.id,
          direction: isInbound ? "inbound" : "outbound",
          body: messageBody,
          delivered,
          external_id: messageSid,
          sent_at: sentAt,
        },
        { onConflict: "external_id" },
      );
      if (messageError) throw messageError;

      return new Response("<Response/>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

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

    // Tag after-hours calls so they're filterable in the dashboard.
    let tag: string | null = null;
    if (direction.startsWith("inbound")) {
      const { data: company } = await supabase
        .from("companies")
        .select("business_hours_always_on, business_hours_open, business_hours_close, business_hours_timezone")
        .eq("id", mapping.company_id)
        .maybeSingle();
      if (company && company.business_hours_always_on === false) {
        const open = company.business_hours_open ? String(company.business_hours_open) : "08:00";
        const close = company.business_hours_close ? String(company.business_hours_close) : "18:00";
        const tz = company.business_hours_timezone || "America/New_York";
        const callAt = params.Timestamp ? new Date(params.Timestamp) : new Date();
        const inside = isInsideBusinessHours({ at: callAt, open, close, timezone: tz });
        if (!inside) tag = "after-hours";
      }
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
        tag,
        summary: `${direction === "inbound" ? "Incoming" : "Outgoing"} call ${
          status === "missed-followup" ? "(missed)" : "completed"
        }${tag === "after-hours" ? " · after hours" : ""}.`,
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