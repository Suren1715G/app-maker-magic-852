const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_AGENT_PROMPT = `You are an AI receptionist inside a live business dashboard.

You have two app tools available:
- navigate_to({ destination }) to move to another page in the app.
- get_current_screen() to read the user's currently visible page.

The app may also send SCREEN_CONTEXT_UPDATE messages. Treat those as the exact live screen currently visible to the user.

Rules:
1. If the user asks about calls, messages, calendar, leads, reviews, analytics, billing, referrals, support, settings, or any business metric, use the visible screen content to answer directly.
2. If the answer is on another page, navigate there yourself, read the screen, and then answer with the actual numbers or facts you found.
3. Never tell the user that the information must be visible if you already received screen content from get_current_screen() or SCREEN_CONTEXT_UPDATE.
4. Never ask the user to click to another page first if you can navigate there yourself.
5. Keep answers short, direct, and spoken like a live receptionist on a call.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    if (!ELEVENLABS_AGENT_ID) throw new Error("ELEVENLABS_AGENT_ID not configured");

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVENLABS_AGENT_ID}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );

    if (!resp.ok) {
      const t = await resp.text();
      console.error("ElevenLabs token error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Failed to mint token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    let companyPrompt: string | null = null;
    let firstMessage: string | null = null;
    let voiceId: string | null = null;
    // Try to load the caller's company AI customization (best-effort).
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
      if (authHeader && SUPABASE_URL && SUPABASE_ANON_KEY) {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
        const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await supa.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const { data: profile } = await supa
            .from("profiles")
            .select("company_id, business_name")
            .eq("user_id", uid)
            .maybeSingle();
          if (profile?.company_id) {
            const { data: company } = await supa
              .from("companies")
              .select("name, ai_system_prompt, ai_first_message, ai_voice_id")
              .eq("id", profile.company_id)
              .maybeSingle();
            if (company) {
              const businessName = profile.business_name || company.name;
              companyPrompt = company.ai_system_prompt;
              firstMessage = company.ai_first_message
                ? company.ai_first_message.replaceAll("{business}", businessName ?? "")
                : null;
              voiceId = company.ai_voice_id;
            }
          }
        }
      }
    } catch (e) {
      console.error("voice-token overrides lookup failed:", e);
    }

    const prompt = companyPrompt
      ? `${BASE_AGENT_PROMPT}\n\nBusiness-specific instructions:\n${companyPrompt}`
      : BASE_AGENT_PROMPT;

    const overrides: Record<string, unknown> = {
      agent: {
        prompt: { prompt },
        ...(firstMessage ? { firstMessage } : {}),
      },
      ...(voiceId ? { tts: { voiceId } } : {}),
    };

    return new Response(
      JSON.stringify({ token: data.token, agentId: ELEVENLABS_AGENT_ID, overrides }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("voice-token error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});