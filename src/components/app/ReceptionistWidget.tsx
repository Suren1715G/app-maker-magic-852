import { useState, useCallback, useEffect } from "react";
import { Mic, MicOff, PhoneOff, Phone, Sparkles, X, Loader2 } from "lucide-react";
import {
  useConversation,
  useConversationClientTool,
  type DisconnectionDetails,
} from "@elevenlabs/react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { captureVisibleScreenAfterDelay } from "@/lib/screenContext";
import { ReceptionistOrb } from "./ReceptionistOrb";
import { JarvisNetwork } from "./JarvisNetwork";

type Transcript = { id: string; role: "user" | "agent"; text: string };
type VoiceTokenResponse = {
  signedUrl?: string;
  agentId?: string;
  error?: string;
  code?: string;
  retryable?: boolean;
};

function isQuotaMessage(message?: string | null) {
  return /quota|credits? remaining|payment required|insufficient credits/i.test(message ?? "");
}

function getFriendlyVoiceError(message?: string | null) {
  if (!message) return "Call ended unexpectedly";
  if (/missing (conversational ai )?permissions|convai_write|missing_permissions/i.test(message)) {
    return "Voice is unavailable because the ElevenLabs API key is missing Conversational AI permissions (convai_write).";
  }
  if (isQuotaMessage(message)) {
    return "Voice is unavailable because the ElevenLabs account has no remaining quota.";
  }
  return message;
}

function getDisconnectMessage(details?: DisconnectionDetails) {
  if (!details) return null;
  if ("message" in details && typeof details.message === "string") {
    return details.message;
  }
  if ("closeReason" in details && typeof details.closeReason === "string") {
    return details.closeReason;
  }
  return null;
}

// Friendly destinations the AI can navigate to. Keys are matched case-insensitively.
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

export function ReceptionistWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  const conversation = useConversation({
    onConnect: () => {
      setCallError(null);
      toast.success("Connected to Jarvis");
    },
    onDisconnect: (details?: DisconnectionDetails) => {
      setElapsed(0);
      setMuted(false);
      const friendlyMessage = getFriendlyVoiceError(getDisconnectMessage(details));

      if (details?.reason === "error") {
        console.warn("Voice disconnected with error:", details);
        setCallError(friendlyMessage);
        if (isQuotaMessage(friendlyMessage)) {
          setQuotaExceeded(true);
        }
        toast.error(friendlyMessage);
      }
    },
    onError: (message: string) => {
      console.warn("Voice error:", message);
      const friendlyMessage = getFriendlyVoiceError(message);
      setCallError(friendlyMessage);
      if (isQuotaMessage(friendlyMessage)) {
        setQuotaExceeded(true);
      }
      toast.error(friendlyMessage);
    },
    onMessage: ({ message, source }) => {
      if (!message) return;
      setTranscripts((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: source === "user" ? "user" : "agent",
          text: message,
        },
      ]);
    },
  });

  // Tool: navigate inside the app
  useConversationClientTool(
    "navigate_to",
    async (params: { destination?: string }) => {
      const key = (params?.destination ?? "").toLowerCase().trim();
      const match = NAV_DESTINATIONS[key];
      if (!match) {
        return `Unknown destination "${params?.destination}". Available: ${Object.keys(
          NAV_DESTINATIONS,
        ).join(", ")}`;
      }
      navigate(match.path);
      toast.success(`Opening ${match.label}`);

      const snapshot = await captureVisibleScreenAfterDelay(1200, 6000);
      return [
        `Navigated to ${match.label} (path: ${snapshot.path}).`,
        "IMPORTANT: The block below is the ONLY source of truth for what is currently on the user's screen.",
        "Do NOT invent numbers, names, counts, or items that are not literally present in this block.",
        "If the user asks about something not shown here, say you don't see it on the current screen.",
        "----- BEGIN VISIBLE SCREEN -----",
        snapshot.content || "(No readable content found on the page.)",
        "----- END VISIBLE SCREEN -----",
      ]
        .join("\n");
    },
  );

  // Tool: read the page the user is currently on
  useConversationClientTool("get_current_screen", async () => {
    try {
      const snapshot = await captureVisibleScreenAfterDelay(500, 6000);
      return [
        "IMPORTANT: The block below is the ONLY source of truth for what is currently on the user's screen.",
        "Do NOT invent numbers, names, counts, or items not literally present in this block.",
        "If the user asks about something not shown here, say you don't see it on the current screen.",
        `Path: ${snapshot.path}`,
        snapshot.title ? `Title: ${snapshot.title}` : "",
        "----- BEGIN VISIBLE SCREEN -----",
        snapshot.content || "(No readable content found on the page.)",
        "----- END VISIBLE SCREEN -----",
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      return "Error: Could not read screen. Tell the user you can't see the page right now.";
    }
  });

  // Tool: current date & time (so the AI doesn't guess)
  useConversationClientTool("get_current_time", async () => {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }),
      timezone: tz,
      day: now.toLocaleDateString(undefined, { weekday: "long" }),
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
    });
  });

  const status = conversation.status;
  const isConnected = status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Call timer
  useEffect(() => {
    if (!isConnected) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [isConnected]);

  const startCall = useCallback(async () => {
    if (quotaExceeded) {
      toast.error("Voice is unavailable until the ElevenLabs quota is restored.");
      return;
    }

    setConnecting(true);
    try {
      // Mic permission MUST be requested directly inside the click handler.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setCallError(null);

      const { data, error } = await supabase.functions.invoke<VoiceTokenResponse>("voice-token");
      if (error || !data?.signedUrl) {
        console.error("Token error:", error, data);
        const friendlyMessage = getFriendlyVoiceError(
          data?.error ?? error?.message ?? "Could not start call",
        );
        setCallError(friendlyMessage);
        if (isQuotaMessage(friendlyMessage)) {
          setQuotaExceeded(true);
        }
        toast.error(friendlyMessage);
        return;
      }

      setTranscripts([]);
      setElapsed(0);

      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const initialScreen = await captureVisibleScreenAfterDelay(0, 6000);

      const sessionPrompt = [
        "You are the in-app AI receptionist for a small business owner.",
        "",
        "## Tools you have",
        "- get_current_screen(): returns the user's currently visible screen content. CALL THIS whenever the user asks about what's on their screen, what they see, what's in front of them, or anything specific to the current page.",
        "- navigate_to(destination): opens a page in the app (home, calls, calendar, sms, leads, reviews, analytics, notifications, billing, referrals, support, assistant, settings).",
        "- get_current_time(): returns the current date, day, and time.",
        "",
        "## Rules",
        "- You CAN see the user's screen — never tell them you cannot. Always call get_current_screen first if uncertain.",
        "- Only state facts that appear in the screen tool result. Do not invent counts, names, numbers, or items.",
        "- After navigating, call get_current_screen to describe the new page.",
        "- Be brief and conversational.",
        "",
        `## Current context`,
        `Date/time: ${now.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" })} (${tz}).`,
        `Today is ${now.toLocaleDateString(undefined, { weekday: "long" })}.`,
        `Current page path: ${initialScreen.path}`,
        initialScreen.title ? `Page title: ${initialScreen.title}` : "",
        "",
        "Initial visible screen content (use this until the user navigates):",
        "----- BEGIN VISIBLE SCREEN -----",
        initialScreen.content || "(empty)",
        "----- END VISIBLE SCREEN -----",
      ]
        .filter(Boolean)
        .join("\n");

      await conversation.startSession({
        signedUrl: data.signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: sessionPrompt },
          },
        },
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

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    try {
      conversation.setMuted?.(next);
    } catch {
      /* ignore */
    }
  }, [muted, conversation]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Jarvis"
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
          <div
            className={cn(
              "absolute pointer-events-auto",
              isConnected
                ? "bottom-40 right-4 w-[220px]"
                : "bottom-40 right-4 left-4 sm:left-auto sm:w-[360px]",
            )}
          >
            <div
              className={cn(
                "glass-strong rounded-3xl border border-border/60 shadow-2xl flex flex-col overflow-hidden animate-slide-up",
                isConnected ? "max-h-[260px]" : "max-h-[75vh]",
              )}
            >
              {/* Hero — 3D Jarvis network (only when idle) */}
              {!isConnected && (
                <div className="relative h-[200px] overflow-hidden">
                  <JarvisNetwork />
                  {/* Vignette so the network fades into the panel */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, hsl(var(--card) / 0.55) 70%, hsl(var(--card)) 100%)",
                    }}
                  />
                  {/* Close button */}
                  <button
                    onClick={() => setOpen(false)}
                    className="absolute top-3 right-3 z-10 h-7 w-7 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {/* Centered title overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                    <span className="glass rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-primary flex items-center gap-1.5 mb-2.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          quotaExceeded
                            ? "bg-destructive"
                            : connecting
                              ? "bg-accent animate-pulse"
                              : "bg-success animate-pulse",
                        )}
                      />
                      {quotaExceeded
                        ? "Offline"
                        : connecting
                          ? "Connecting"
                          : "// Standing by"}
                    </span>
                    <h2 className="font-display text-4xl font-semibold leading-none">
                      <span className="prism-text">Jarvis</span>
                    </h2>
                  </div>
                </div>
              )}

              {/* Body copy / orb when in-call */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-2",
                  isConnected ? "pt-4 pb-2" : "pb-3 px-5",
                )}
              >
                {isConnected ? (
                  <>
                    <ReceptionistOrb speaking={isSpeaking} connected size={88} />
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {isSpeaking ? "Speaking…" : "Listening…"}
                      </div>
                      <div className="text-xs font-mono text-foreground">
                        {formatTime(elapsed)}
                      </div>
                    </div>
                  </>
                ) : callError ? (
                  <div className="text-xs text-destructive text-center max-w-[260px]">
                    {callError}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center max-w-[260px]">
                    Hands-free call. Just speak — Jarvis will answer back.
                  </div>
                )}
              </div>

              {/* Controls */}
              <div
                className={cn(
                  "flex items-center justify-center gap-3",
                  isConnected ? "p-3" : "border-t border-border/60 p-4",
                )}
              >
                {!isConnected ? (
                  <button
                    onClick={startCall}
                    disabled={connecting || quotaExceeded}
                    className={cn(
                      "h-14 px-6 rounded-full font-semibold text-sm flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100",
                      quotaExceeded
                        ? "bg-card border border-border text-muted-foreground"
                        : "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_8px_28px_-6px_hsl(var(--primary)/0.7)]",
                    )}
                  >
                    {quotaExceeded ? (
                      <>
                        <PhoneOff className="h-4 w-4" /> Voice unavailable
                      </>
                    ) : connecting ? (
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
                        "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                        muted
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-card border border-border text-foreground",
                      )}
                      aria-label={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={endCall}
                      className="h-12 w-12 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      aria-label="End call"
                    >
                      <PhoneOff className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      className="h-10 w-10 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
                      aria-label="Hide"
                    >
                      <X className="h-4 w-4" />
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