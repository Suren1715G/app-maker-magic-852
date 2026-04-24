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

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfWeekUTC(): Date {
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() - 7);
  return d;
}
function startOfMonthUTC(): Date {
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() - 30);
  return d;
}

function periodStart(period: string) {
  return period === "week" ? startOfWeekUTC() : period === "month" ? startOfMonthUTC() : startOfTodayUTC();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SHARED_SECRET = Deno.env.get("ASSISTANT_TOOL_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SHARED_SECRET) {
      console.error("ASSISTANT_TOOL_SECRET is not configured");
      return json({ error: "Server misconfigured" }, 500);
    }

    // Auth: shared secret header
    const provided = req.headers.get("x-assistant-secret");
    if (provided !== SHARED_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();
    const company_id = String(body?.company_id ?? "").trim();

    if (!company_id) return json({ error: "company_id is required" }, 400);
    if (!action) return json({ error: "action is required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate company_id belongs to a registered agent (defense in depth)
    const { data: agentRow } = await admin
      .from("company_elevenlabs_agents")
      .select("company_id")
      .eq("company_id", company_id)
      .maybeSingle();
    if (!agentRow) {
      return json({ error: "Unknown company" }, 404);
    }

    switch (action) {
      case "data_index": {
        // Tell the agent exactly what data sources are live vs not-yet-connected.
        return json({
          available: [
            { topic: "calls", actions: ["call_stats", "recent_calls", "search_calls"], note: "Real call records from the receptionist." },
            { topic: "sms_messages", actions: ["message_stats", "recent_messages", "search_messages"], note: "Real SMS/text conversations stored for this company." },
            { topic: "leads", actions: ["leads_summary"], note: "Derived from calls tagged lead/booking/quote." },
            { topic: "business_info", actions: ["business_info"], note: "Company name + provisioned phone numbers." },
          ],
          not_yet_connected: [
            { topic: "reviews", note: "Reviews are not yet wired to live data. Page shows demo content. Offer to navigate to /reviews." },
            { topic: "calendar_appointments", note: "Calendar/appointments are not yet wired to live data. Offer to navigate to /calendar." },
            { topic: "notes_reminders", note: "Notes can be CREATED via perform_action(create_note) but cannot yet be listed/queried. Offer to navigate to /notes." },
            { topic: "notifications", note: "Notifications feed is not yet queryable. Offer to navigate to /notifications." },
          ],
        });
      }

      case "business_info": {
        const [{ data: company }, { data: phones }] = await Promise.all([
          admin.from("companies").select("name").eq("id", company_id).maybeSingle(),
          admin
            .from("company_phone_numbers")
            .select("phone_number, label, status")
            .eq("company_id", company_id)
            .order("created_at", { ascending: true }),
        ]);
        return json({
          company_name: company?.name ?? null,
          phone_numbers: phones ?? [],
        });
      }

      case "call_stats": {
        const period = String(body?.period ?? "today");
        const since = periodStart(period);
        const { data, error } = await admin
          .from("calls")
          .select("status, duration_sec, tag")
          .eq("company_id", company_id)
          .gte("started_at", since.toISOString());
        if (error) {
          console.error("call_stats error", error);
          return json({ error: "Database error" }, 500);
        }
        const total = data?.length ?? 0;
        const answered = data?.filter((c) => c.status === "answered").length ?? 0;
        const missed = data?.filter((c) => c.status === "missed").length ?? 0;
        const voicemail = data?.filter((c) => c.status === "voicemail").length ?? 0;
        const totalDurationSec =
          data?.reduce((sum, c) => sum + (c.duration_sec ?? 0), 0) ?? 0;
        const avgDurationSec = total > 0 ? Math.round(totalDurationSec / total) : 0;
        return json({
          period,
          total,
          answered,
          missed,
          voicemail,
          total_duration_sec: totalDurationSec,
          average_duration_sec: avgDurationSec,
        });
      }

      case "message_stats": {
        const period = String(body?.period ?? "today");
        const since = periodStart(period);
        const { data, error } = await admin
          .from("sms_messages")
          .select("direction, delivered, sent_at")
          .eq("company_id", company_id)
          .gte("sent_at", since.toISOString());
        if (error) {
          console.error("message_stats error", error);
          return json({ error: "Database error" }, 500);
        }
        const messages = data ?? [];
        return json({
          period,
          total: messages.length,
          received: messages.filter((m) => m.direction === "inbound").length,
          sent: messages.filter((m) => m.direction === "outbound").length,
          delivered: messages.filter((m) => m.delivered).length,
          undelivered: messages.filter((m) => !m.delivered).length,
        });
      }

      case "recent_messages": {
        const limit = Math.min(Math.max(Number(body?.limit ?? 10), 1), 30);
        const { data, error } = await admin
          .from("sms_messages")
          .select("direction, body, delivered, sent_at, sms_threads(customer, phone)")
          .eq("company_id", company_id)
          .order("sent_at", { ascending: false })
          .limit(limit);
        if (error) {
          console.error("recent_messages error", error);
          return json({ error: "Database error" }, 500);
        }
        return json({ messages: data ?? [] });
      }

      case "search_messages": {
        const query = String(body?.query ?? "").trim();
        if (!query) return json({ error: "query is required" }, 400);
        const escaped = query.replace(/[%_]/g, "");
        const { data, error } = await admin
          .from("sms_messages")
          .select("direction, body, delivered, sent_at, sms_threads(customer, phone)")
          .eq("company_id", company_id)
          .ilike("body", `%${escaped}%`)
          .order("sent_at", { ascending: false })
          .limit(20);
        if (error) {
          console.error("search_messages error", error);
          return json({ error: "Database error" }, 500);
        }
        return json({ messages: data ?? [] });
      }

      case "recent_calls": {
        const limit = Math.min(Math.max(Number(body?.limit ?? 5), 1), 20);
        const { data, error } = await admin
          .from("calls")
          .select("caller, phone, started_at, duration_sec, status, summary, tag")
          .eq("company_id", company_id)
          .order("started_at", { ascending: false })
          .limit(limit);
        if (error) {
          console.error("recent_calls error", error);
          return json({ error: "Database error" }, 500);
        }
        return json({ calls: data ?? [] });
      }

      case "search_calls": {
        const query = String(body?.query ?? "").trim();
        if (!query) return json({ error: "query is required" }, 400);
        const isPhone = /[0-9]/.test(query);
        const escaped = query.replace(/[%_]/g, "");
        const filter = isPhone
          ? `phone.ilike.%${escaped}%,caller.ilike.%${escaped}%`
          : `caller.ilike.%${escaped}%,phone.ilike.%${escaped}%`;
        const { data, error } = await admin
          .from("calls")
          .select("caller, phone, started_at, duration_sec, status, summary, tag")
          .eq("company_id", company_id)
          .or(filter)
          .order("started_at", { ascending: false })
          .limit(10);
        if (error) {
          console.error("search_calls error", error);
          return json({ error: "Database error" }, 500);
        }
        return json({ calls: data ?? [] });
      }

      case "leads_summary": {
        // We don't have a leads table — derive from calls tagged as lead/booking
        const period = String(body?.period ?? "week");
        const since =
          period === "today"
            ? startOfTodayUTC()
            : period === "month"
              ? startOfMonthUTC()
              : startOfWeekUTC();
        const { data, error } = await admin
          .from("calls")
          .select("caller, phone, started_at, summary, tag")
          .eq("company_id", company_id)
          .gte("started_at", since.toISOString())
          .order("started_at", { ascending: false });
        if (error) {
          console.error("leads_summary error", error);
          return json({ error: "Database error" }, 500);
        }
        const leads = (data ?? []).filter((c) => {
          const t = (c.tag ?? "").toLowerCase();
          return t.includes("lead") || t.includes("book") || t.includes("quote");
        });
        return json({
          period,
          total_leads: leads.length,
          recent: leads.slice(0, 5),
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("assistant-lookup error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
