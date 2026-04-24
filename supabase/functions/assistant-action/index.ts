import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-assistant-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

async function sendSms(toNumber: string, fromNumber: string, message: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    throw new Error("Twilio not configured");
  }
  const resp = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: toNumber, From: fromNumber, Body: message }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Twilio error ${resp.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function normalizePhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (p.startsWith("+")) return p;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SHARED_SECRET = Deno.env.get("ASSISTANT_TOOL_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SHARED_SECRET) return json({ error: "Server misconfigured" }, 500);

    if (req.headers.get("x-assistant-secret") !== SHARED_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();
    const company_id = String(body?.company_id ?? "").trim();
    const confirmed = body?.confirmed === true || body?.confirmed === "true";

    if (!company_id) return json({ error: "company_id is required" }, 400);
    if (!action) return json({ error: "action is required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate company_id is a real registered agent's company
    const { data: agentRow } = await admin
      .from("company_elevenlabs_agents")
      .select("company_id")
      .eq("company_id", company_id)
      .maybeSingle();
    if (!agentRow) return json({ error: "Unknown company" }, 404);

    // Find a creator user_id for this company (any company_admin) — used for created_by columns
    const { data: anyProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("company_id", company_id)
      .limit(1)
      .maybeSingle();
    const actor_user_id = anyProfile?.user_id ?? null;

    switch (action) {
      case "tag_call": {
        const call_id = String(body?.call_id ?? "").trim();
        const tag = String(body?.tag ?? "").trim();
        if (!call_id || !tag) return json({ error: "call_id and tag are required" }, 400);
        if (!confirmed) {
          return json({
            preview: `Tag call ${call_id} as "${tag}".`,
            requires_confirmation: true,
          });
        }
        const { error } = await admin
          .from("calls")
          .update({ tag })
          .eq("id", call_id)
          .eq("company_id", company_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, message: `Call tagged as "${tag}".` });
      }

      case "send_sms": {
        const to = normalizePhone(String(body?.to ?? ""));
        const message = String(body?.message ?? "").trim();
        if (!to || !message) return json({ error: "to and message are required" }, 400);
        if (message.length > 1500) return json({ error: "Message too long" }, 400);

        // Find an active company phone number
        const { data: phones } = await admin
          .from("company_phone_numbers")
          .select("phone_number, status")
          .eq("company_id", company_id)
          .order("created_at", { ascending: true });
        const usable = phones?.find((p) => p.status === "active") ?? phones?.[0];
        if (!usable) return json({ error: "No phone number on file" }, 400);
        const from = normalizePhone(usable.phone_number);

        if (!confirmed) {
          return json({
            preview: `Send SMS from ${from} to ${to}: "${message}"`,
            requires_confirmation: true,
            warning: usable.status !== "active"
              ? `Note: your number is "${usable.status}" — sending may fail.`
              : undefined,
          });
        }

        try {
          const result = await sendSms(to, from, message);
          const sentAt = new Date().toISOString();
          const { data: thread, error: threadError } = await admin
            .from("sms_threads")
            .upsert(
              { company_id, phone: to, customer: to, last_message_at: sentAt },
              { onConflict: "company_id,phone" },
            )
            .select("id")
            .single();
          if (threadError) throw threadError;

          const { error: messageError } = await admin.from("sms_messages").upsert(
            {
              company_id,
              thread_id: thread.id,
              direction: "outbound",
              body: message,
              delivered: true,
              external_id: result?.sid ?? null,
              sent_at: sentAt,
            },
            { onConflict: "external_id" },
          );
          if (messageError) throw messageError;

          return json({ ok: true, message: "SMS sent.", sid: result?.sid });
        } catch (e) {
          console.error("SMS error", e);
          return json({
            ok: false,
            error: e instanceof Error ? e.message : "SMS failed",
          }, 502);
        }
      }

      case "create_note": {
        const title = String(body?.title ?? "").trim();
        const noteBody = String(body?.body ?? "").trim();
        const due_at = body?.due_at ? new Date(String(body.due_at)).toISOString() : null;
        if (!title) return json({ error: "title is required" }, 400);
        if (!actor_user_id) return json({ error: "No company member found" }, 400);
        if (!confirmed) {
          return json({
            preview: due_at
              ? `Create reminder "${title}" for ${due_at}${noteBody ? ` — ${noteBody}` : ""}.`
              : `Create note "${title}"${noteBody ? `: ${noteBody}` : ""}.`,
            requires_confirmation: true,
          });
        }
        const { error } = await admin.from("notes").insert({
          company_id,
          created_by: actor_user_id,
          title,
          body: noteBody || null,
          due_at,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, message: "Note saved." });
      }

      case "create_phone_request":
      case "create_location_request": {
        return json({
          ok: false,
          error:
            "This action no longer goes through the server. Walk the user through the on-screen form on the Settings page instead: navigate_to('settings'), then click_element('Request a new location') or the phone-request button, then fill_field each field with confirm-first, then click_element('Send request'). After it sends, ask if they want to click_element('Book a meeting') for Calendly.",
        }, 400);
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("assistant-action error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
