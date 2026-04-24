// Internal helper used by other edge functions (voice-token, etc.)
// Not user-facing — only callable with the service role key OR shared secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TEMPLATE_AGENT_ID = "agent_1801knmztaavfa0bh6pa94vw9s2f";

async function fetchTemplate(apiKey: string) {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${TEMPLATE_AGENT_ID}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Failed to fetch template agent: ${resp.status} ${t}`);
  }
  return resp.json();
}

function buildAssistantTool(supabaseUrl: string, secret: string, companyId: string) {
  return {
    type: "webhook",
    name: "lookup_business_data",
    description:
      "Look up information about THIS company's business: call counts, recent calls, search calls by phone or name, lead/booking stats, and business info (phone numbers). Use this whenever the user asks about their dashboard, calls, leads, customers, or business data.",
    api_schema: {
      url: `${supabaseUrl}/functions/v1/assistant-lookup`,
      method: "POST",
      request_headers: {
        "x-assistant-secret": secret,
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: [
              "data_index",
              "business_info",
              "call_stats",
              "recent_calls",
              "search_calls",
              "message_stats",
              "recent_messages",
              "search_messages",
              "leads_summary",
            ],
            description:
              "Which lookup to perform. data_index = list ALL data sources available + which topics are NOT yet connected; business_info = company name + phone numbers; call_stats = call counts for a period; recent_calls = latest N calls; search_calls = find calls by name/phone; message_stats = SMS/text counts for a period; recent_messages = latest SMS/text messages; search_messages = find SMS/texts by message body; leads_summary = leads/bookings.",
          },
          period: {
            type: "string",
            enum: ["today", "week", "month"],
            description: "For call_stats and leads_summary. Defaults to today / week.",
          },
          limit: {
            type: "number",
            description: "For recent_calls. Default 5, max 20.",
          },
          query: {
            type: "string",
            description: "For search_calls — phone number or caller name.",
          },
          // company_id is injected server-side as a constant value
          company_id: {
            type: "string",
            constant_value: companyId,
          },
        },
      },
    },
  };
}

function buildActionTool(supabaseUrl: string, secret: string, companyId: string) {
  return {
    type: "webhook",
    name: "perform_action",
    description:
      "Server-side actions WITHOUT an on-screen form: tag a call, send an SMS, or create a note/reminder. ALWAYS call with confirmed=false first to get a preview, repeat to the user, get verbal yes, then call again with confirmed=true. NEVER use this for 'request a new location' or 'request a new phone number' — those MUST be done by walking the user through the on-screen form on /settings using navigate_to + click_element + fill_field.",
    api_schema: {
      url: `${supabaseUrl}/functions/v1/assistant-action`,
      method: "POST",
      request_headers: {
        "x-assistant-secret": secret,
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: [
              "tag_call",
              "send_sms",
              "create_note",
            ],
            description:
              "Which action to perform. tag_call (needs call_id, tag); send_sms (needs to, message); create_note (needs title; optional body, due_at ISO datetime). For requesting a new LOCATION or new PHONE NUMBER, do NOT use this tool — walk the user through the form on /settings using navigate_to + click_element + fill_field.",
          },
          confirmed: {
            type: "boolean",
            description:
              "MUST be false on the first call (returns a preview). After the user verbally confirms, call AGAIN with confirmed=true.",
          },
          call_id: { type: "string", description: "For tag_call." },
          tag: { type: "string", description: "For tag_call (e.g. 'lead', 'booking', 'spam')." },
          to: { type: "string", description: "For send_sms — destination phone." },
          message: { type: "string", description: "For send_sms — message text." },
          title: { type: "string", description: "For create_note." },
          body: { type: "string", description: "For create_note — optional details." },
          due_at: { type: "string", description: "For create_note — optional ISO datetime for reminder." },
          label: { type: "string", description: "For create_phone_request — what the number is for." },
          location_name: { type: "string", description: "For create_location_request." },
          locations_wanted: { type: "number", description: "For create_location_request — default 1." },
          note: { type: "string", description: "For create_location_request — optional context." },
          company_id: {
            type: "string",
            constant_value: companyId,
          },
        },
      },
    },
  };
}

function buildClientTools() {
  return [
    {
      type: "client",
      name: "get_current_screen",
      description: "Read the user's current app screen. Use before claiming you can or cannot see a control.",
      expects_response: true,
      response_timeout_secs: 20,
      parameters: { type: "object", properties: {}, required: [] },
    },
    {
      type: "client",
      name: "navigate_to",
      description: "Navigate inside the app to a known page such as settings, notifications, calls, calendar, sms, leads, reviews, analytics, billing, referrals, support, assistant, or home.",
      expects_response: true,
      response_timeout_secs: 20,
      parameters: {
        type: "object",
        required: ["destination"],
        properties: { destination: { type: "string", description: "The destination page name." } },
      },
    },
  ];
}

function injectCompanyContext(
  baseSystemPrompt: string | undefined,
  companyName: string,
  companyId: string,
) {
  const block = `\n\n---\nYou are the AI receptionist and assistant for "${companyName}".\n\n## Core rule\nNEVER say "I can't help with that" or "I don't have access" without first calling lookup_business_data. If you are unsure whether a topic is queryable, call lookup_business_data with action="data_index" — it returns the full list of what IS connected and what is NOT yet connected.\n\n## Live data you CAN query (via lookup_business_data)\n- Calls: counts, recent calls, search by name or phone (call_stats, recent_calls, search_calls)\n- SMS / text messages: counts, recent texts, search by message body (message_stats, recent_messages, search_messages)\n- Leads & bookings: derived from tagged calls (leads_summary)\n- Business info: company name, phone numbers (business_info)\n\n## NOT yet connected to live data\nThese pages exist in the app but currently show demo / placeholder content — there is no real database behind them yet:\n- Reviews\n- Calendar / appointments\n- Notifications feed\n- Notes list (you CAN create notes via perform_action, but cannot list them)\n\nIf the user asks about messages or texts, use message_stats/recent_messages/search_messages. If there are zero results, say there are no tracked messages for that period yet — do not say you cannot see messages.\n\n## Actions\n- Use perform_action for server-only work (tag a call, send SMS, create a note/reminder). Always confirm-first: confirmed=false to preview, repeat to user, get verbal yes, then confirmed=true.\n- Use navigate_to to take the user to a page when they want to change a setting, request a new location/phone number, or fill a form. You do NOT click buttons, toggle switches, or type in forms — describe verbally where the control is and let the user act.\n- NEVER claim you clicked, submitted, toggled, sent, or completed something unless a tool literally returned success.\n\nAlways pass company_id="${companyId}" exactly as-is to server tools.\n---\n`;
  return (baseSystemPrompt ?? "") + block;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ASSISTANT_TOOL_SECRET = Deno.env.get("ASSISTANT_TOOL_SECRET");

    if (!ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY not set" }, 500);
    if (!ASSISTANT_TOOL_SECRET) return json({ error: "ASSISTANT_TOOL_SECRET not set" }, 500);

    // Internal-only: caller must present the shared assistant secret
    const provided = req.headers.get("x-internal-secret");
    if (provided !== ASSISTANT_TOOL_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const company_id = String(body?.company_id ?? "").trim();
    if (!company_id) return json({ error: "company_id is required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get company name
    const { data: company } = await admin
      .from("companies")
      .select("name, ai_voice_id")
      .eq("id", company_id)
      .maybeSingle();
    if (!company) return json({ error: "Company not found" }, 404);

    // Already provisioned? Upgrade it instead of creating a new one.
    const { data: existing } = await admin
      .from("company_elevenlabs_agents")
      .select("agent_id")
      .eq("company_id", company_id)
      .maybeSingle();

    const lookupTool = buildAssistantTool(SUPABASE_URL, ASSISTANT_TOOL_SECRET, company_id);
    const actionTool = buildActionTool(SUPABASE_URL, ASSISTANT_TOOL_SECRET, company_id);
    const clientTools = buildClientTools();

    if (existing?.agent_id) {
      // Fetch current config, ensure lookup tool + company context block are present.
      const curResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${existing.agent_id}`,
        { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
      );
      if (!curResp.ok) {
        return json(
          { error: "Could not fetch existing agent", detail: await curResp.text() },
          502,
        );
      }
      const cur = await curResp.json();
      const curPrompt = cur?.conversation_config?.agent?.prompt ?? {};
      const curTools = Array.isArray(curPrompt?.tools) ? curPrompt.tools : [];
      const filteredTools = curTools.filter(
        (t: any) =>
          t?.name !== "lookup_business_data" &&
          t?.name !== "perform_action" &&
          !clientTools.some((clientTool) => clientTool.name === t?.name),
      );
      const promptText: string = curPrompt?.prompt ?? "";
      // Strip any prior injected block so we always re-inject the latest version
      const stripped = promptText.replace(
        /\n\n---\nYou are the AI receptionist[\s\S]*?---\n/,
        "",
      );
      const newPromptText = injectCompanyContext(stripped, company.name, company_id);

      const patchResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${existing.agent_id}`,
        {
          method: "PATCH",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_config: {
              agent: {
                prompt: {
                  prompt: newPromptText,
                  tools: [...filteredTools, lookupTool, actionTool, ...clientTools],
                },
              },
            },
          }),
        },
      );
      if (!patchResp.ok) {
        return json(
          { error: "Failed to upgrade existing agent", detail: await patchResp.text() },
          502,
        );
      }
      return json({ ok: true, agent_id: existing.agent_id, created: false, upgraded: true });
    }

    // Pull template config
    const template = await fetchTemplate(ELEVENLABS_API_KEY);
    const templateConvConfig = template?.conversation_config ?? {};
    const baseAgent = templateConvConfig?.agent ?? {};
    const basePrompt = baseAgent?.prompt ?? {};

    // Build new agent payload — clone conv config, override prompt + tools
    const newPayload: Record<string, unknown> = {
      name: `${company.name} — Receptionist`,
      conversation_config: {
        ...templateConvConfig,
        agent: {
          ...baseAgent,
          prompt: {
            ...basePrompt,
            prompt: injectCompanyContext(basePrompt?.prompt, company.name, company_id),
            tools: [
              ...(Array.isArray(basePrompt?.tools) ? basePrompt.tools : []),
              lookupTool,
              actionTool,
              ...clientTools,
            ],
          },
        },
      },
    };

    // Override voice if company picked one
    if (company.ai_voice_id) {
      const conv = newPayload.conversation_config as Record<string, any>;
      conv.tts = { ...(conv.tts ?? {}), voice_id: company.ai_voice_id };
    }

    const createResp = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPayload),
    });

    if (!createResp.ok) {
      const errText = await createResp.text();
      console.error("ElevenLabs create failed:", createResp.status, errText);
      return json({ error: "Failed to create agent", detail: errText }, 502);
    }

    const created = await createResp.json();
    const newAgentId: string | undefined = created?.agent_id;
    if (!newAgentId) {
      return json({ error: "ElevenLabs did not return an agent_id", detail: created }, 502);
    }

    const { error: insErr } = await admin
      .from("company_elevenlabs_agents")
      .insert({ company_id, agent_id: newAgentId });
    if (insErr) {
      console.error("Failed to save agent_id:", insErr);
      return json({ error: "Saved agent in ElevenLabs but failed to record it", detail: insErr.message }, 500);
    }

    return json({ ok: true, agent_id: newAgentId, created: true });
  } catch (e) {
    console.error("provision-company-agent error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
