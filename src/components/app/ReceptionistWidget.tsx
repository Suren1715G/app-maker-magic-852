import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Phone, Sparkles, X, Loader2 } from "lucide-react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  captureVisibleScreen,
  captureVisibleScreenAfterDelay,
  formatVisibleScreenContext,
} from "@/lib/screenContext";

type Transcript = { id: string; role: "user" | "agent"; text: string };

// Map of friendly destinations the AI can navigate to.
// Keep keys lowercase and simple — the agent matches on these.
const NAV_DESTINATIONS: Record<string, { path: string; label: string }> = {
  home: { path: "/", label: "Home" },
  dashboard: { path: "/", label: "Home" },
  calls: { path: "/calls", label: "Calls" },
  calendar: { path: "/calendar", label: "Calendar" },
  appointments: { path: "/calendar", label: "Calendar" },
  schedule: { path: "/calendar", label: "Calendar" },
  sms: { path: "/sms", label: "Messages" },
  messages: { path: "/sms", label: "Messages" },
  texts: { path: "/sms", label: "Messages" },
  leads: { path: "/leads", label: "Leads" },
  reviews: { path: "/reviews", label: "Reviews" },
  analytics: { path: "/analytics", label: "Analytics" },
  reports: { path: "/analytics", label: "Analytics" },
  notifications: { path: "/notifications", label: "Notifications" },
  billing: { path: "/billing", label: "Billing" },
  referrals: { path: "/referrals", label: "Referrals" },
  support: { path: "/support", label: "Support" },
  help: { path: "/support", label: "Support" },
  assistant: { path: "/assistant", label: "Assistant" },
  settings: { path: "/settings", label: "Settings" },
};

function ReceptionistWidgetInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const screenContextHashRef = useRef("");
  const pushScreenContextRef = useRef<
    (reason?: string, options?: { delayMs?: number; force?: boolean }) => Promise<void>
  >(async () => {});

  const conversation = useConversation({
    clientTools: {
      // Agent calls this to navigate the user inside the app.
      navigate_to: (params: { destination?: string }) => {
        const key = (params?.destination ?? "").toLowerCase().trim();
        const match = NAV_DESTINATIONS[key];
        if (!match) {
          return `Unknown destination "${params?.destination}". Available: ${Object.keys(
            NAV_DESTINATIONS,
          ).join(", ")}`;
        }
        navigate(match.path);
        toast.success(`Opening ${match.label}`);
        window.setTimeout(() => {
          void pushScreenContextRef.current(`The app navigated to ${match.label}.`, {
            delayMs: 0,
            force: true,
          });
        }, 900);
        // Keep the widget open so the call stays visible and active.
        return `Navigated to ${match.label}. I am reading the page now and will answer using what is visible on screen.`;
      },
      // Agent calls this to read whatever page the user is currently on.
      // Returns the route + visible text content so the AI can answer
      // questions like "how many calls today?" based on what's on screen.
      get_current_screen: async () => {
        try {
          return JSON.stringify(await captureVisibleScreenAfterDelay(700, 5000));
        } catch {
          return JSON.stringify({ error: "Could not read screen" });
        }
      },
    },
    onConnect: () => toast.success("Connected to your AI receptionist"),
    onDisconnect: () => {
      setElapsed(0);
      setMuted(false);
    },
    onError: (err: unknown) => {
      console.error("Voice error:", err);
      toast.error("Voice connection error");
    },
    onMessage: (msg: { source: "user" | "ai"; message: string }) => {
      if (!msg?.message) return;
      setTranscripts((p) => [
        ...p,
        { id: crypto.randomUUID(), role: msg.source === "user" ? "user" : "agent", text: msg.message },
      ]);
      if (msg.source === "user") {
        void pushScreenContextRef.current("The user just asked about the currently visible app screen.", {
          delayMs: 120,
          force: true,
        });
      }
    },
  });

  const status = conversation.status;
  const isConnected = status === "connected";
  const isSpeaking = conversation.isSpeaking;

  const pushScreenContext = useCallback(
    async (
      reason = "The visible app screen changed.",
      options?: { delayMs?: number; force?: boolean },
    ) => {
      const delayMs = options?.delayMs ?? 300;
      if (delayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }

      const snapshot = captureVisibleScreen();
      const signature = `${snapshot.path}::${snapshot.title}::${snapshot.content}`;
      if (!options?.force && signature === screenContextHashRef.current) return;

      screenContextHashRef.current = signature;

      try {
        await conversation.sendContextualUpdate?.(formatVisibleScreenContext(snapshot, reason));
      } catch (error) {
        console.error("Failed to push screen context:", error);
      }
    },
    [conversation],
  );

  useEffect(() => {
    pushScreenContextRef.current = pushScreenContext;
  }, [pushScreenContext]);

  useEffect(() => {
    if (!isConnected) {
      screenContextHashRef.current = "";
      return;
    }

    void pushScreenContext("The user is currently viewing this page.", { delayMs: 250, force: true });
  }, [isConnected, location.pathname, location.search, pushScreenContext]);

  // Call timer
  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  const startCall = useCallback(async () => {
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("voice-token");
      if (error || !data?.token) {
        console.error("Token error:", error, data);
        toast.error("Could not start call");
        return;
      }

      setTranscripts([]);
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
        overrides: data.overrides ?? undefined,
      });
    } catch (e) {
      console.error(e);
      toast.error("Microphone permission required");
    } finally {
      setConnecting(false);
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    try {
      conversation.setMuted?.(next);
    } catch {
      // no-op
    }
  }, [muted, conversation]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI receptionist"
        className={cn(
          "fixed bottom-24 right-4 z-40 h-12 w-12 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-accent text-primary-foreground",
          "flex items-center justify-center transition-all hover:scale-105",
          isConnected && "ring-4 ring-success/40 animate-pulse",
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        {!open && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
              isConnected ? "bg-success animate-pulse" : "bg-success",
            )}
          />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute bottom-40 right-4 left-4 sm:left-auto sm:w-[360px] pointer-events-auto">
            <div className="glass-strong rounded-3xl border border-border/60 shadow-2xl flex flex-col max-h-[75vh] overflow-hidden animate-slide-up">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
                <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold leading-tight">AI Receptionist</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isConnected ? "bg-success animate-pulse" : "bg-muted-foreground/50",
                      )}
                    />
                    {isConnected
                      ? isSpeaking
                        ? "Speaking…"
                        : "Listening…"
                      : "Tap call to start"}
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Visualizer / Avatar */}
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="relative">
                  <div
                    className={cn(
                      "h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center",
                      "shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)]",
                      isSpeaking && "animate-pulse",
                    )}
                  >
                    <Sparkles className="h-10 w-10 text-primary-foreground" />
                  </div>
                  {isConnected && (
                    <>
                      <span className="absolute inset-0 rounded-full ring-2 ring-primary/30 animate-ping" />
                      {isSpeaking && (
                        <span className="absolute -inset-2 rounded-full ring-2 ring-accent/40 animate-ping" />
                      )}
                    </>
                  )}
                </div>
                <div className="text-center">
                  {isConnected ? (
                    <div className="text-xs font-mono text-muted-foreground">{formatTime(elapsed)}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground max-w-[240px]">
                      Hands-free call. Just speak — your AI receptionist will answer back.
                    </div>
                  )}
                </div>
              </div>

              {/* Live transcript */}
              {isConnected && transcripts.length > 0 && (
                <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5 max-h-[180px]">
                  {transcripts.slice(-6).map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "text-[11px] px-2.5 py-1.5 rounded-xl",
                        t.role === "user"
                          ? "bg-primary/10 text-foreground ml-6"
                          : "bg-card border border-border/60 text-muted-foreground mr-6",
                      )}
                    >
                      <span className="font-medium mr-1">{t.role === "user" ? "You:" : "AI:"}</span>
                      {t.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Controls */}
              <div className="border-t border-border/60 p-4 flex items-center justify-center gap-3">
                {!isConnected ? (
                  <button
                    onClick={startCall}
                    disabled={connecting}
                    className="h-14 px-6 rounded-full bg-success text-success-foreground font-semibold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform disabled:opacity-60"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4" /> Start call
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center transition-colors",
                        muted
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-card border border-border text-foreground",
                      )}
                      aria-label={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={endCall}
                      className="h-14 w-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      aria-label="End call"
                    >
                      <PhoneOff className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ReceptionistWidget() {
  return (
    <ConversationProvider>
      <ReceptionistWidgetInner />
    </ConversationProvider>
  );
}