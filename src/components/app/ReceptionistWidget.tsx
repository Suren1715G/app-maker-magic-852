import { useState, useCallback, useEffect, useRef } from "react";
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
import { clickByLabel, fillFieldByLabel, listVisibleControls } from "@/lib/screenActions";
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

  // Tool: click any visible button/link/tab/switch by its visible label.
  // Confirmation flow: AI calls confirmed=false first → we return what WOULD happen.
  // After verbal user "yes", AI calls again with confirmed=true to actually click.
  useConversationClientTool(
    "click_element",
    async (params: { label?: string; confirmed?: boolean | string }) => {
      const label = (params?.label ?? "").trim();
      const confirmed = params?.confirmed === true || params?.confirmed === "true";
      if (!label) return "Error: label is required.";

      // Preview pass — find target without clicking.
      if (!confirmed) {
        const probe = clickByLabel(label, { allowDestructive: true });
        if (!probe.ok) {
          return `Could not find "${label}". ${probe.reason}${
            probe.candidates?.length
              ? ` Visible buttons include: ${probe.candidates.slice(0, 10).join(", ")}.`
              : ""
          } Ask the user to clarify.`;
        }
        // Don't actually click — undo by stopping here. We just return preview.
        return `PREVIEW (not yet clicked): I will click "${probe.matched ?? label}".${
          probe.destructive
            ? " This looks DESTRUCTIVE — repeat it back to the user and require an explicit yes before calling again with confirmed=true."
            : " Confirm with the user, then call again with confirmed=true."
        }`;
      }

      const result = clickByLabel(label, { allowDestructive: true });
      if (!result.ok) {
        return `Click failed: ${result.reason}${
          result.candidates?.length
            ? ` Visible buttons: ${result.candidates.slice(0, 10).join(", ")}.`
            : ""
        }`;
      }
      const snap = await captureVisibleScreenAfterDelay(900, 6000);
      return [
        `Clicked "${result.matched ?? label}".`,
        "Updated screen below — describe to the user only what's actually here.",
        "----- BEGIN VISIBLE SCREEN -----",
        snap.content || "(empty)",
        "----- END VISIBLE SCREEN -----",
      ].join("\n");
    },
  );

  // Tool: type into a field by its label/placeholder.
  useConversationClientTool(
    "fill_field",
    async (params: { label?: string; value?: string; confirmed?: boolean | string }) => {
      const label = (params?.label ?? "").trim();
      const value = String(params?.value ?? "");
      const confirmed = params?.confirmed === true || params?.confirmed === "true";
      if (!label) return "Error: label is required.";
      if (value === "") return "Error: value is required.";

      if (!confirmed) {
        const controls = listVisibleControls();
        const matchHint = controls.fields.find((f) =>
          f.toLowerCase().includes(label.toLowerCase()),
        );
        return `PREVIEW (not yet typed): I will set "${label}"${
          matchHint ? ` (matched field: "${matchHint}")` : ""
        } to "${value}". Confirm with the user, then call again with confirmed=true.`;
      }

      const result = fillFieldByLabel(label, value);
      if (!result.ok) {
        return `Fill failed: ${result.reason}${
          result.candidates?.length
            ? ` Visible fields: ${result.candidates.slice(0, 10).join(", ")}.`
            : ""
        }`;
      }
      return `Filled "${result.matchedLabel ?? label}" with "${value}". Remind the user to click Save/Submit if needed.`;
    },
  );

  // Tool: list everything Jarvis can act on right now (buttons + fields).
  useConversationClientTool("list_actions", async () => {
    const c = listVisibleControls();
    return JSON.stringify({
      clickable_elements: c.clickable,
      input_fields: c.fields,
      hint: "To click, call click_element({label, confirmed:false}) then with confirmed:true. To type, call fill_field({label, value, confirmed:false}) then confirmed:true.",
    });
  });

  const status = conversation.status;
  const isConnected = status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Live audio amplitude (0..1) sampled every frame and read by JarvisNetwork.
  const levelRef = useRef({ current: 0 });

  useEffect(() => {
    if (!isConnected) {
      levelRef.current.current = 0;
      return;
    }
    let raf = 0;
    const tick = () => {
      try {
        // Prefer agent output when speaking, else mic input.
        const data = isSpeaking
          ? conversation.getOutputByteFrequencyData?.()
          : conversation.getInputByteFrequencyData?.();
        if (data && data.length) {
          // Use lower frequency bins (voice energy) — more responsive than RMS over all bins.
          const bins = Math.min(32, data.length);
          let sum = 0;
          for (let i = 0; i < bins; i++) sum += data[i];
          const avg = sum / bins / 255; // 0..1
          // Boost — most speech sits in the lower end of the range.
          levelRef.current.current = Math.min(1, avg * 1.8);
        }
      } catch {
        /* ignore */
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isConnected, isSpeaking, conversation]);

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
            className="absolute pointer-events-auto bottom-40 right-4 left-4 sm:left-auto sm:w-[360px]"
          >
            <div
              className="glass-strong rounded-3xl border border-border/60 shadow-2xl flex flex-col overflow-hidden animate-slide-up max-h-[75vh]"
            >
              {/* Hero — 3D Jarvis network (always shown) */}
              <div className="relative h-[200px] overflow-hidden">
                <JarvisNetwork levelRef={levelRef.current} />
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
                          : isConnected
                            ? "bg-success animate-pulse"
                            : connecting
                              ? "bg-accent animate-pulse"
                              : "bg-success animate-pulse",
                      )}
                    />
                    {quotaExceeded
                      ? "Offline"
                      : isConnected
                        ? isSpeaking
                          ? "// Speaking"
                          : "// Listening"
                        : connecting
                          ? "Connecting"
                          : "// Standing by"}
                  </span>
                  <h2 className="font-display text-4xl font-semibold leading-none">
                    <span className="prism-text">Jarvis</span>
                  </h2>
                  {isConnected && (
                    <div className="text-xs font-mono text-foreground/90 mt-2 tabular-nums">
                      {formatTime(elapsed)}
                    </div>
                  )}
                </div>
              </div>

              {/* Body copy */}
              <div className="flex flex-col items-center justify-center gap-2 pb-3 px-5 pt-1">
                {callError ? (
                  <div className="text-xs text-destructive text-center max-w-[260px]">
                    {callError}
                  </div>
                ) : !isConnected ? (
                  <div className="text-xs text-muted-foreground text-center max-w-[260px]">
                    Hands-free call. Just speak — Jarvis will answer back.
                  </div>
                ) : null}
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