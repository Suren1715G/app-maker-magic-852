const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getFriendlyElevenLabsError(status: number, errorBody: string) {
  try {
    const parsed = JSON.parse(errorBody) as {
      detail?: { status?: string; message?: string };
    };

    if (parsed.detail?.status === "missing_permissions") {
      return {
        error:
          "Voice is unavailable because the ElevenLabs API key is missing Conversational AI permissions (convai_write).",
        code: parsed.detail.status,
        retryable: false,
      };
    }

    if (/quota|credits? remaining|payment required|insufficient credits/i.test(parsed.detail?.message ?? "")) {
      return {
        error: "Voice is unavailable because the ElevenLabs account has no remaining quota.",
        code: parsed.detail?.status ?? `http_${status}`,
        retryable: false,
      };
    }

    return {
      error: parsed.detail?.message || `ElevenLabs request failed (${status}).`,
      code: parsed.detail?.status ?? `http_${status}`,
      retryable: status >= 500,
    };
  } catch {
    return {
      error: errorBody || `ElevenLabs request failed (${status}).`,
      code: `http_${status}`,
      retryable: status >= 500,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
    if (!ELEVENLABS_AGENT_ID) throw new Error("ELEVENLABS_AGENT_ID is not configured");

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );

    if (!resp.ok) {
      const errorBody = await resp.text();
      console.error("ElevenLabs signed-url error:", resp.status, errorBody);
      const friendlyError = getFriendlyElevenLabsError(resp.status, errorBody);

      return new Response(
        JSON.stringify(friendlyError),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await resp.json();

    return new Response(
      JSON.stringify({
        signedUrl: data.signed_url,
        agentId: ELEVENLABS_AGENT_ID,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("voice-token error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});