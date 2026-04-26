import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Whitelist of voices customers are allowed to pick.
// Keep this in sync with VOICE_OPTIONS in src/pages/app/Settings.tsx.
const ALLOWED_VOICES = new Set<string>([
  "wDsJlOXPqcvIUKdLXjDs", // Jarvis
  "UgBBYS2sOqTuMpoF3BR0", // Mark
  "eXpIbVcVbLo8ZJQDlDnl", // Siren
  "l4Coq6695JDX9xtLqXDE", // Lauren
  "tnSpp4vdxKPjI9w0GnoV", // Hope
]);

// Build a short business-hours instruction block to splice into the system
// prompt. The AI gets told what the hours are, what timezone they're in,
// and how to behave after hours (polite decline + callback promise).
function buildHoursPrompt(opts: {
  alwaysOn: boolean;
  open: string | null;
  close: string | null;
  timezone: string | null;
  companyName: string | null;
}): string {
  const tz = opts.timezone || "America/New_York";
  if (opts.alwaysOn || !opts.open || !opts.close) {
    return `BUSINESS HOURS: This business is open 24/7. Always answer normally regardless of time.`;
  }
  const open = String(opts.open).slice(0, 5);
  const close = String(opts.close).slice(0, 5);
  return [
    `BUSINESS HOURS:`,
    `- Open daily ${open}–${close} (${tz}).`,
    `- Before answering, silently check the current time in ${tz}.`,
    `- If the call is INSIDE business hours: answer normally and help the caller.`,
    `- If the call is OUTSIDE business hours: be brief and polite. Say something like "Thanks for calling${opts.companyName ? ` ${opts.companyName}` : ""}. We're currently closed — our hours are ${open} to ${close}. I'll make sure someone calls you back first thing when we're open. Can I get your name and a good number to reach you?" Take their name + number, then end the call warmly. Do NOT book appointments or quote prices outside hours.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Auth: must be a logged-in user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // 2. Validate input. `voice_id` is optional now — when omitted we just
    //    re-sync hours/system-prompt using whatever's already in the DB.
    const body = await req.json().catch(() => ({}));
    const rawVoice = typeof body?.voice_id === "string" ? body.voice_id.trim() : "";
    const voiceId = rawVoice || null;
    if (voiceId && !ALLOWED_VOICES.has(voiceId)) {
      return new Response(JSON.stringify({ error: "Invalid voice_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Find caller's company (via service role to bypass RLS noise)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileErr || !profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company linked to your account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Confirm caller is a company_admin for that company
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "company_admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Find this company's ElevenLabs agent
    const { data: agentRow } = await admin
      .from("company_elevenlabs_agents")
      .select("agent_id")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    // 6. Persist voice choice in DB if a new one was provided.
    if (voiceId) {
      const { error: updateErr } = await admin
        .from("companies")
        .update({ ai_voice_id: voiceId })
        .eq("id", profile.company_id);
      if (updateErr) {
        console.error("DB update failed:", updateErr);
        return new Response(JSON.stringify({ error: "Could not save voice" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 7. Load current company settings so we can also push hours to the agent.
    const { data: company } = await admin
      .from("companies")
      .select("name, ai_voice_id, ai_system_prompt, business_hours_always_on, business_hours_open, business_hours_close, business_hours_timezone")
      .eq("id", profile.company_id)
      .maybeSingle();

    // 8. If there's no agent linked, we still saved the preference — just tell the client.
    if (!agentRow?.agent_id) {
      return new Response(
        JSON.stringify({
          ok: true,
          synced: false,
          message: voiceId
            ? "Voice saved. No live agent linked yet — your account manager will apply it during setup."
            : "Saved. No live agent linked yet — your account manager will apply it during setup.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 9. Build the agent payload: voice (if any) + a fresh system prompt with
    //    a business-hours block appended/replaced.
    const effectiveVoice = voiceId ?? company?.ai_voice_id ?? null;
    const hoursBlock = buildHoursPrompt({
      alwaysOn: company?.business_hours_always_on ?? true,
      open: company?.business_hours_open ?? null,
      close: company?.business_hours_close ?? null,
      timezone: company?.business_hours_timezone ?? null,
      companyName: company?.name ?? null,
    });
    // Strip any previous hours block (delimited by markers) so we don't keep
    // appending duplicates each time we re-sync.
    const HOURS_START = "<!-- HOURS:START -->";
    const HOURS_END = "<!-- HOURS:END -->";
    const basePrompt = (company?.ai_system_prompt ?? "")
      .replace(new RegExp(`${HOURS_START}[\\s\\S]*?${HOURS_END}`, "g"), "")
      .trim();
    const newPrompt = `${basePrompt}\n\n${HOURS_START}\n${hoursBlock}\n${HOURS_END}`.trim();

    const conversationConfig: Record<string, unknown> = {
      agent: {
        prompt: { prompt: newPrompt },
      },
    };
    if (effectiveVoice) {
      conversationConfig.tts = { voice_id: effectiveVoice };
    }

    // Persist the updated system prompt locally too, so the next sync picks
    // up from the same baseline.
    await admin
      .from("companies")
      .update({ ai_system_prompt: newPrompt })
      .eq("id", profile.company_id);

    // 10. Push to ElevenLabs
    const elResp = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentRow.agent_id}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_config: conversationConfig }),
      },
    );

    if (!elResp.ok) {
      const errText = await elResp.text();
      console.error("ElevenLabs PATCH failed:", elResp.status, errText);
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            elResp.status === 404
              ? "Linked agent not found in ElevenLabs."
              : "Saved, but couldn't sync to the live agent. Try again shortly.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, synced: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-elevenlabs-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});