import { AppShell } from "@/components/app/AppShell";
import { type CallTag } from "@/data/mock";
import { fmtDuration, fmtTime } from "@/lib/format";
import { ArrowLeft, Bot, CalendarPlus, Phone, User, Tag } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type LiveCall = {
  id: string;
  caller: string | null;
  phone: string | null;
  startedAt: string;
  durationSec: number;
  summary: string | null;
  tag: CallTag | null;
  recordingUrl: string | null;
  transcript: { speaker: "AI" | "Caller"; text: string; at?: string }[];
};

const allTags: CallTag[] = ["lead", "booked", "follow-up", "spam"];
const tagTone: Record<CallTag, string> = {
  lead: "bg-primary/20 text-primary border-primary/40",
  booked: "bg-success/20 text-success border-success/40",
  "follow-up": "bg-accent/20 text-accent border-accent/40",
  spam: "bg-muted text-muted-foreground border-border",
};

const CallDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState<LiveCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState<CallTag | undefined>();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("calls")
        .select(
          "id, caller, phone, started_at, duration_sec, summary, tag, recording_url, transcript",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const live: LiveCall = {
          id: data.id,
          caller: data.caller,
          phone: data.phone,
          startedAt: data.started_at,
          durationSec: data.duration_sec,
          summary: data.summary,
          tag: (data.tag as CallTag | null) ?? null,
          recordingUrl: data.recording_url,
          transcript: Array.isArray(data.transcript)
            ? (data.transcript as LiveCall["transcript"])
            : [],
        };
        setCall(live);
        setTag(live.tag ?? undefined);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const persistTag = async (t: CallTag) => {
    setTag(t);
    const { error } = await supabase.from("calls").update({ tag: t }).eq("id", id!);
    if (error) toast.error("Couldn't save tag");
    else toast.success(`Tagged as ${t}`);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="pt-10 text-center text-sm text-muted-foreground">Loading call…</div>
      </AppShell>
    );
  }

  if (!call) {
    return (
      <AppShell>
        <div className="pt-10 text-center">
          <p className="text-muted-foreground">Call not found.</p>
          <Link to="/calls" className="text-primary text-sm mt-3 inline-block">Back to calls</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pt-4 -ml-1"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <header className="py-4">
        <h1 className="font-display text-2xl font-semibold">{call.caller ?? "Unknown caller"}</h1>
        <p className="text-sm text-muted-foreground">{call.phone} · {fmtTime(call.startedAt)} · {fmtDuration(call.durationSec)}</p>
      </header>

      {call.recordingUrl && (
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recording</div>
          <audio controls className="w-full">
            <source src={call.recordingUrl} type="audio/mpeg" />
          </audio>
        </div>
      )}

      <div className="glass rounded-2xl p-4 mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">AI summary</div>
        <p className="text-sm leading-relaxed">{call.summary ?? "No summary yet."}</p>
      </div>

      <div className="glass rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
          <Tag className="h-3 w-3" /> Tag this call
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => persistTag(t)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border capitalize transition-colors",
                tag === t ? tagTone[t] : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <a
          href={`tel:${call.phone}`}
          className="glass rounded-2xl p-4 flex flex-col items-center gap-1.5 text-sm font-medium hover:bg-secondary/40"
        >
          <Phone className="h-5 w-5 text-primary" /> Call back
        </a>
        <Link
          to="/calendar"
          className="glass rounded-2xl p-4 flex flex-col items-center gap-1.5 text-sm font-medium hover:bg-secondary/40"
        >
          <CalendarPlus className="h-5 w-5 text-accent" /> View booking
        </Link>
      </div>

      <h2 className="font-display text-lg font-semibold mb-3">Transcript</h2>
      {call.transcript.length === 0 && (
        <p className="text-sm text-muted-foreground mb-6">No transcript available for this call.</p>
      )}
      <ul className="space-y-3">
        {call.transcript.map((t, i) => {
          const isAI = t.speaker === "AI";
          return (
            <li key={i} className={"flex gap-2 " + (isAI ? "" : "flex-row-reverse")}>
              <div
                className={
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 " +
                  (isAI ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent")
                }
              >
                {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div
                className={
                  "rounded-2xl px-3.5 py-2.5 text-sm max-w-[75%] " +
                  (isAI ? "glass" : "bg-accent/15 border border-accent/20")
                }
              >
                {t.text}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
};

export default CallDetail;
