// Scheduled function — fires once per minute via pg_cron.
// Finds notes whose due_at has passed, are not done, and have not yet been
// reminded, then inserts a notification for each and marks reminded_at.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: due, error } = await supabase
      .from("notes")
      .select("id, title, body, company_id, created_by, due_at")
      .lte("due_at", new Date().toISOString())
      .eq("done", false)
      .is("reminded_at", null)
      .limit(200);

    if (error) throw error;

    let fired = 0;
    for (const n of due ?? []) {
      const { error: insErr } = await supabase.from("notifications").insert({
        company_id: n.company_id,
        user_id: n.created_by,
        type: "note",
        title: `Reminder: ${n.title}`,
        body: (n.body ?? "").slice(0, 140) || "Note due now.",
        link: "/notes",
        metadata: { note_id: n.id, due_at: n.due_at },
      });
      if (insErr) {
        console.error("notify insert failed", n.id, insErr.message);
        continue;
      }
      await supabase
        .from("notes")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", n.id);
      fired++;
    }

    return new Response(JSON.stringify({ ok: true, fired, checked: due?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notes-reminder error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});