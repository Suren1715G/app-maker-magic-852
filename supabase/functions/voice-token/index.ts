const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Try to load the caller's company AI customization (best-effort).
    let overrides: Record<string, unknown> | null = null;
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
              const agent: Record<string, unknown> = {};
              if (company.ai_system_prompt) {
                agent.prompt = { prompt: company.ai_system_prompt };
              }
              if (company.ai_first_message) {
                agent.firstMessage = company.ai_first_message
                  .replaceAll("{business}", businessName ?? "");
              }
              const tts: Record<string, unknown> = {};
              if (company.ai_voice_id) tts.voiceId = company.ai_voice_id;
              overrides = {};
              if (Object.keys(agent).length) (overrides as any).agent = agent;
              if (Object.keys(tts).length) (overrides as any).tts = tts;
            }
          }
        }
      }
    } catch (e) {
      console.error("voice-token overrides lookup failed:", e);
    }

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