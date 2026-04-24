import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const FALLBACK_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ASSISTANT_TOOL_SECRET = Deno.env.get("ASSISTANT_TOOL_SECRET");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    // Resolve which agent to use: caller's company agent (auto-provision if missing).
    let agentId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await userClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub as string | undefined;

      if (userId) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await admin
          .from("profiles")
          .select("company_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (profile?.company_id) {
          const { data: agentRow } = await admin
            .from("company_elevenlabs_agents")
            .select("agent_id")
            .eq("company_id", profile.company_id)
            .maybeSingle();

          if (agentRow?.agent_id) {
            agentId = agentRow.agent_id;
          } else {
            // Auto-provision a fresh agent for this company
            console.log("Provisioning agent for company", profile.company_id);
            const provResp = await fetch(
              `${SUPABASE_URL}/functions/v1/provision-company-agent`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-secret": ASSISTANT_TOOL_SECRET ?? "",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ company_id: profile.company_id }),
              },
            );
            if (provResp.ok) {
              const provData = await provResp.json();
              if (provData?.agent_id) agentId = provData.agent_id;
            } else {
              console.error(
                "Auto-provision failed:",
                provResp.status,
                await provResp.text(),
              );
            }
          }
        }
      }
    }

    // Fall back to global template agent if we couldn't resolve a per-company one
    if (!agentId) agentId = FALLBACK_AGENT_ID ?? null;
    if (!agentId) throw new Error("No ElevenLabs agent available");

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );

    if (!resp.ok) {
      const errorBody = await resp.text();
      console.error("ElevenLabs signed-url error:", resp.status, errorBody);
      return new Response(
        JSON.stringify(getFriendlyElevenLabsError(resp.status, errorBody)),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await resp.json();
    return new Response(
      JSON.stringify({ signedUrl: data.signed_url, agentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
