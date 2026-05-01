// ElevenLabs Conversational AI post-call webhook receiver.
// Configure in ElevenLabs dashboard: Conversational AI -> Webhooks -> Post-call
// URL: https://<project-ref>.supabase.co/functions/v1/elevenlabs-webhook
//
// Each conversation is tied to a company via the
// `company_elevenlabs_agents` table (agent_id -> company_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, elevenlabs-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Classification = { tag: "lead" | "booked" | "follow-up" | "spam" | null; booked: boolean };

async function classifyCall(opts: {
  summary: string;
  transcript: { speaker: string; text: string }[];
}): Promise<Classification> {
  if (!LOVABLE_API_KEY) return { tag: null, booked: false };
  const transcriptText = opts.transcript
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n")
    .slice(0, 6000);
  const prompt = `You are classifying a phone call to a small business AI receptionist.

SUMMARY:
${opts.summary || "(none)"}

TRANSCRIPT:
${transcriptText || "(empty)"}

Classify this call. Respond with a JSON tool call.
- tag "booked": caller successfully scheduled/confirmed an appointment.
- tag "lead": genuine prospective customer asking about services/pricing/availability but no booking confirmed.
- tag "follow-up": existing customer or caller who needs a callback / unresolved question / message taken.
- tag "spam": wrong number, robocall, solicitation, telemarketer, or nonsense.
- booked: true only if an appointment was actually scheduled in this call.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_call",
              description: "Assign a tag and booking status to the call.",
              parameters: {
                type: "object",
                properties: {
                  tag: { type: "string", enum: ["lead", "booked", "follow-up", "spam"] },
                  booked: { type: "boolean" },
                },
                required: ["tag", "booked"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_call" } },
      }),
    });
    if (!res.ok) {
      console.warn("classifyCall non-OK", res.status, await res.text());
      return { tag: null, booked: false };
    }
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { tag: null, booked: false };
    const parsed = JSON.parse(args);
    return { tag: parsed.tag ?? null, booked: Boolean(parsed.booked) };
  } catch (e) {
    console.warn("classifyCall error", e);
    return { tag: null, booked: false };
  }
}

function buildSummary(transcript: any[]): string {
  if (!Array.isArray(transcript) || transcript.length === 0) return "";
  const firstCaller = transcript.find(
    (t) => (t.role || t.speaker)?.toString().toLowerCase().includes("user"),
  );
  if (firstCaller?.message || firstCaller?.text) {
    const text = (firstCaller.message ?? firstCaller.text) as string;
    return text.length > 220 ? text.slice(0, 217) + "…" : text;
  }
  return "AI receptionist conversation.";
}

function normalizeTranscript(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => ({
    speaker: ((t.role ?? t.speaker ?? "") + "").toLowerCase().includes("user")
      ? "Caller"
      : "AI",
    text: t.message ?? t.text ?? "",
    at: t.time_in_call_secs != null ? `${t.time_in_call_secs}s` : "",
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    // ElevenLabs wraps the conversation under `data` with type
    // "post_call_transcription". We accept both shapes for safety.
    const data = payload?.data ?? payload;
    const agentId: string | undefined = data.agent_id;
    const conversationId: string | undefined =
      data.conversation_id ?? data.id ?? payload.event_id;

    if (!agentId || !conversationId) {
      return new Response(
        JSON.stringify({ error: "Missing agent_id or conversation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: mapping } = await supabase
      .from("company_elevenlabs_agents")
      .select("company_id")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (!mapping?.company_id) {
      console.warn(`No company mapped for agent ${agentId}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: "no mapping" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const transcript = normalizeTranscript(data.transcript);
    const meta = data.metadata ?? {};
    const phoneCall = meta.phone_call ?? {};
    const dynamicVariables =
      data.dynamic_variables ??
      data.conversation_initiation_client_data?.dynamic_variables ??
      {};
    const phone =
      meta.caller_id ??
      meta.phone_number ??
      phoneCall.external_number ??
      dynamicVariables.system__caller_id ??
      null;
    const toNumber =
      meta.called_number ??
      meta.to_number ??
      phoneCall.agent_number ??
      dynamicVariables.system__called_number ??
      null;

    const startedAt = meta.start_time_unix_secs
      ? new Date(meta.start_time_unix_secs * 1000).toISOString()
      : new Date().toISOString();
    const duration =
      meta.call_duration_secs ?? meta.duration_secs ?? data.duration_secs ?? 0;

    const summary =
      data.analysis?.transcript_summary ??
      data.analysis?.summary ??
      buildSummary(data.transcript ?? []);

    const classification = await classifyCall({ summary, transcript });
    const finalStatus = classification.booked ? "booked" : "answered";

    // Skip in-app / web widget conversations — these are the business owner
    // talking to their own AI assistant inside the app, not a real customer
    // call to the business. Real inbound phone calls always have a caller_id
    // (and usually a called_number) populated by the telephony layer.
    const isPhoneCall = Boolean(phone) || Boolean(toNumber);
    if (!isPhoneCall) {
      // Some ElevenLabs/Twilio phone integrations omit caller metadata in the
      // post-call webhook even though Twilio has already logged the call. When
      // that happens, attach the transcript to the most recent Twilio call for
      // the same company instead of dropping it.
      const recentSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentCalls, error: recentCallsError } = await supabase
        .from("calls")
        .select("id, duration_sec, metadata")
        .eq("company_id", mapping.company_id)
        .eq("source", "twilio")
        .is("transcript", null)
        .gte("created_at", recentSince)
        .order("created_at", { ascending: false })
        .limit(5);
      if (recentCallsError) throw recentCallsError;

      const recentCall = recentCalls?.find((call) => {
        const twilioDuration = Number(call.duration_sec ?? 0);
        const elevenDuration = Number(duration ?? 0);
        return elevenDuration === 0 || Math.abs(twilioDuration - elevenDuration) <= 180;
      }) ?? recentCalls?.[0];

      if (recentCall) {
        const existingMetadata =
          recentCall.metadata && typeof recentCall.metadata === "object"
            ? recentCall.metadata as Record<string, unknown>
            : {};
        const { error: updateError } = await supabase
          .from("calls")
          .update({
            status: finalStatus,
            tag: classification.tag,
            duration_sec: duration,
            summary,
            transcript,
            recording_url: data.audio_url ?? null,
            metadata: {
              ...existingMetadata,
              elevenlabs: {
                agent_id: agentId,
                conversation_id: conversationId,
                analysis: data.analysis ?? null,
                classification,
                attached_without_phone_metadata: true,
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", recentCall.id);
        if (updateError) throw updateError;

        console.log(
          `Attached metadata-free ElevenLabs transcript ${conversationId} to Twilio call ${recentCall.id}`,
        );
        return new Response(JSON.stringify({ ok: true, attached_to: recentCall.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(
        `Skipping in-app conversation ${conversationId} (no phone metadata)`,
      );
      return new Response(
        JSON.stringify({ ok: true, skipped: "in-app conversation" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only record/classify calls that came in on a phone number actually
    // assigned to this company. Test calls placed from the ElevenLabs
    // dashboard (or to any other number) are ignored.
    if (!toNumber) {
      console.log(
        `Skipping conversation ${conversationId} — no called_number (likely an ElevenLabs test).`,
      );
      return new Response(
        JSON.stringify({ ok: true, skipped: "no called_number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: numberMatch } = await supabase
      .from("company_phone_numbers")
      .select("id")
      .eq("company_id", mapping.company_id)
      .eq("phone_number", toNumber)
      .maybeSingle();
    if (!numberMatch) {
      console.log(
        `Skipping conversation ${conversationId} — called_number ${toNumber} is not assigned to company ${mapping.company_id}.`,
      );
      return new Response(
        JSON.stringify({ ok: true, skipped: "called_number not assigned to company" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await supabase.from("calls").upsert(
      {
        company_id: mapping.company_id,
        source: "elevenlabs",
        external_id: conversationId,
        caller: meta.caller_name ?? phone ?? "Unknown caller",
        phone,
        to_number: toNumber,
        direction: "inbound",
        status: finalStatus,
        tag: classification.tag,
        duration_sec: duration,
        summary,
        transcript,
        recording_url: data.audio_url ?? null,
        metadata: {
          agent_id: agentId,
          conversation_id: conversationId,
          analysis: data.analysis ?? null,
          classification,
        },
        started_at: startedAt,
      },
      { onConflict: "source,external_id" },
    );

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("elevenlabs-webhook error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});