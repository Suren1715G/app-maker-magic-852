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
    const phone =
      meta.caller_id ??
      meta.phone_number ??
      data.dynamic_variables?.system__caller_id ??
      null;
    const toNumber =
      meta.called_number ??
      meta.to_number ??
      data.dynamic_variables?.system__called_number ??
      null;

    // Skip in-app / web widget conversations — these are the business owner
    // talking to their own AI assistant inside the app, not a real customer
    // call to the business. Real inbound phone calls always have a caller_id
    // (and usually a called_number) populated by the telephony layer.
    const isPhoneCall = Boolean(phone) || Boolean(toNumber);
    if (!isPhoneCall) {
      console.log(
        `Skipping in-app conversation ${conversationId} (no phone metadata)`,
      );
      return new Response(
        JSON.stringify({ ok: true, skipped: "in-app conversation" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const startedAt = meta.start_time_unix_secs
      ? new Date(meta.start_time_unix_secs * 1000).toISOString()
      : new Date().toISOString();
    const duration =
      meta.call_duration_secs ?? meta.duration_secs ?? data.duration_secs ?? 0;

    const { error } = await supabase.from("calls").upsert(
      {
        company_id: mapping.company_id,
        source: "elevenlabs",
        external_id: conversationId,
        caller: meta.caller_name ?? phone ?? "Unknown caller",
        phone,
        to_number: toNumber,
        direction: "inbound",
        status: "answered",
        duration_sec: duration,
        summary:
          data.analysis?.transcript_summary ??
          data.analysis?.summary ??
          buildSummary(data.transcript ?? []),
        transcript,
        recording_url: data.audio_url ?? null,
        metadata: {
          agent_id: agentId,
          conversation_id: conversationId,
          analysis: data.analysis ?? null,
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