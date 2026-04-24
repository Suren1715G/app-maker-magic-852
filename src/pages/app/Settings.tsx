import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ExternalLink, LogOut, Plus, Trash2, Upload, ShieldCheck, UserPlus, Mail, Palette, Zap, Monitor, Smartphone, MapPin, Phone as PhoneIcon, Clock, CalendarPlus, CheckCircle2 } from "lucide-react";
import { sessions } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStoredTheme, setTheme } from "@/lib/theme";

const VOICE_OPTIONS: { id: string; label: string }[] = [
  { id: "wDsJlOXPqcvIUKdLXjDs", label: "Jarvis · British robotic monotone" },
  { id: "UgBBYS2sOqTuMpoF3BR0", label: "Mark · Confident male" },
  { id: "eXpIbVcVbLo8ZJQDlDnl", label: "Siren · Smooth female" },
  { id: "l4Coq6695JDX9xtLqXDE", label: "Lauren · Friendly female" },
  { id: "tnSpp4vdxKPjI9w0GnoV", label: "Hope · Warm female" },
];
const DEFAULT_VOICE_ID = VOICE_OPTIONS[0].id;

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("+1 (844) 790-5754");
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [aiVoiceId, setAiVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [savingAi, setSavingAi] = useState(false);

  // Active locations (read-only — admin manages via Master)
  type LocationRow = {
    id: string;
    label: string | null;
    phone_number: string;
    status: "pending" | "active" | "disabled";
    created_at: string;
  };
  const [locations, setLocations] = useState<LocationRow[]>([]);

  // Location requests (customer-initiated, requires meeting with admin)
  type LocationRequest = {
    id: string;
    location_name: string;
    locations_wanted: number;
    note: string | null;
    status: "new" | "contacted" | "scheduled" | "closed";
    created_at: string;
  };
  const [requests, setRequests] = useState<LocationRequest[]>([]);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqLocName, setReqLocName] = useState("");
  const [reqCount, setReqCount] = useState(1);
  const [reqNote, setReqNote] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const CALENDLY_URL = "https://calendly.com/sgsaireception";

  const [services, setServices] = useState(["Deep Clean", "Move-out Clean", "Office Clean", "Standard Clean"]);
  const [newSvc, setNewSvc] = useState("");
  const [darkMode, setDarkMode] = useState(() => getStoredTheme() === "dark");
  const [logo, setLogo] = useState<string | null>(null);

  // Notifications
  const [notifPush, setNotifPush] = useState(true);
  const [notifNewLead, setNotifNewLead] = useState(true);
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifMissed, setNotifMissed] = useState(true);
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);

  // Security
  const [twoFA, setTwoFA] = useState(false);

  // Team
  const [team, setTeam] = useState<{ email: string; role: string }[]>([
    { email: "owner@sgs.com", role: "Owner" },
  ]);
  const [teamEmail, setTeamEmail] = useState("");

  // White label
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [brandName, setBrandName] = useState("SGS AI");

  // Zapier
  const [zapHook, setZapHook] = useState("");

  const inviteTeammate = () => {
    if (!teamEmail.trim()) return;
    setTeam((p) => [...p, { email: teamEmail.trim(), role: "Receptionist" }]);
    setTeamEmail("");
    toast.success("Invite sent (demo)");
  };

  // Keep the dark-mode switch in sync if the theme is changed elsewhere
  // (e.g. Jarvis flips it via the on-screen toggle).
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: "dark" | "light" }>).detail;
      setDarkMode(detail?.mode !== "light");
    };
    window.addEventListener("themechange", onChange as EventListener);
    return () => window.removeEventListener("themechange", onChange as EventListener);
  }, []);

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target?.result as string);
    reader.readAsDataURL(f);
    toast.success("Logo updated");
  };

  const addService = () => {
    if (!newSvc.trim()) return;
    setServices((p) => [...p, newSvc.trim()]);
    setNewSvc("");
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out.");
    navigate("/auth", { replace: true });
  };

  // Load company AI settings
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);
      const { data: company } = await supabase
        .from("companies")
        .select("ai_voice_id")
        .eq("id", profile.company_id)
        .maybeSingle();
      if (company?.ai_voice_id) {
        // Only honor stored voice if it's still in our allowed list
        const allowed = VOICE_OPTIONS.some((v) => v.id === company.ai_voice_id);
        setAiVoiceId(allowed ? company.ai_voice_id : DEFAULT_VOICE_ID);
      }
      await loadLocations(profile.company_id);
      await loadRequests(profile.company_id);
    })();
  }, [user]);

  const loadLocations = async (cid: string) => {
    const { data } = await supabase
      .from("company_phone_numbers")
      .select("id, label, phone_number, status, created_at")
      .eq("company_id", cid)
      .order("created_at", { ascending: true });
    setLocations((data ?? []) as LocationRow[]);
  };

  const loadRequests = async (cid: string) => {
    const { data } = await supabase
      .from("location_requests")
      .select("id, location_name, locations_wanted, note, status, created_at")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });
    setRequests((data ?? []) as LocationRequest[]);
  };

  const submitLocationRequest = async () => {
    if (!companyId || !user) return toast.error("No company linked to your account");
    const name = reqLocName.trim();
    if (!name) return toast.error("Give the new location a name");
    if (reqCount < 1 || reqCount > 50) return toast.error("Enter a valid number of locations");
    setSubmittingReq(true);
    const { error } = await supabase.from("location_requests").insert({
      company_id: companyId,
      requested_by: user.id,
      location_name: name,
      locations_wanted: reqCount,
      note: reqNote.trim() || null,
    });
    setSubmittingReq(false);
    if (error) {
      toast.error(error.message ?? "Could not submit request");
      return;
    }
    toast.success("Request sent — book a time below");
    setJustSubmitted(true);
    await loadRequests(companyId);
  };

  const resetRequestForm = () => {
    setReqOpen(false);
    setReqLocName("");
    setReqCount(1);
    setReqNote("");
    setJustSubmitted(false);
  };

  const saveAi = async () => {
    if (!companyId) {
      toast.error("No company linked to your account");
      return;
    }
    setSavingAi(true);
    const { data, error } = await supabase.functions.invoke("update-elevenlabs-agent", {
      body: { voice_id: aiVoiceId },
    });
    setSavingAi(false);
    if (error) {
      toast.error(error.message ?? "Failed to update voice");
      return;
    }
    if (data?.synced === false) {
      toast.success(data?.message ?? "Voice saved");
    } else {
      toast.success("Voice updated — live on next call");
    }
  };

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Manage your AI receptionist." />

      {user && (
        <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold">
              {(user.email?.[0] || "?").toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="text-sm font-medium truncate">{user.email}</div>
          </div>
          <label className="text-xs text-primary cursor-pointer flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" /> Logo
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </label>
        </div>
      )}

      <Section title="Business">
        <Field label="Phone number" value={phone} onChange={setPhone} />
        <Toggle
          label="Always on (24/7)"
          hint="AI answers around the clock"
          checked={alwaysOn}
          onChange={setAlwaysOn}
        />
        {!alwaysOn && (
          <div className="px-4 py-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opens</div>
              <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="h-9 bg-input" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Closes</div>
              <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="h-9 bg-input" />
            </div>
          </div>
        )}
      </Section>

      <Section title="Locations & phone numbers">
        {locations.length > 0 && (
          <ul className="px-4 pt-3 pb-1 divide-y divide-border/60">
            {locations.map((l) => {
              const tone =
                l.status === "active"
                  ? "bg-success/15 text-success"
                  : l.status === "pending"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground";
              const Icon = l.status === "pending" ? Clock : MapPin;
              return (
                <li key={l.id} className="py-3 flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.label ?? "Untitled location"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{l.phone_number}</div>
                  </div>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${tone}`}>
                    {l.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {!reqOpen ? (
          <div className="px-4 py-4">
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <CalendarPlus className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Add a new location</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Adding a location includes a new phone number, AI setup, and routing. Pricing depends on call volume — let's chat to scope it.
                  </div>
                </div>
              </div>
              <Button size="sm" className="w-full mt-3" onClick={() => setReqOpen(true)} disabled={!companyId}>
                <CalendarPlus className="h-3.5 w-3.5" /> Request a new location
              </Button>
            </div>

            {requests.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Your requests</div>
                <ul className="divide-y divide-border/60">
                  {requests.map((r) => {
                    const tone =
                      r.status === "scheduled"
                        ? "bg-success/15 text-success"
                        : r.status === "contacted"
                          ? "bg-accent/15 text-accent"
                          : r.status === "closed"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/15 text-primary";
                    return (
                      <li key={r.id} className="py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{r.location_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.locations_wanted} location{r.locations_wanted > 1 ? "s" : ""} · {fmtRel(r.created_at)}
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${tone}`}>
                          {r.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : justSubmitted ? (
          <div className="px-4 py-5">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center">
              <span className="inline-flex h-10 w-10 rounded-full bg-success/20 text-success items-center justify-center mb-2">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="text-sm font-medium">Request received!</div>
              <div className="text-[11px] text-muted-foreground mt-1 mb-3">
                Pick a time that works for you and we'll walk through pricing and setup.
              </div>
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors w-full"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Book a meeting
              </a>
              <button
                onClick={resetRequestForm}
                className="text-[11px] text-muted-foreground hover:text-foreground mt-2.5"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Location name</div>
              <Input
                value={reqLocName}
                onChange={(e) => setReqLocName(e.target.value)}
                placeholder="e.g. Downtown branch"
                className="h-9"
                maxLength={80}
                autoFocus
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">How many new locations?</div>
              <Input
                type="number"
                min={1}
                max={50}
                value={reqCount}
                onChange={(e) => setReqCount(Number(e.target.value) || 1)}
                className="h-9"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Anything we should know? <span className="opacity-60">(optional)</span></div>
              <textarea
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Service area, expected call volume, timing…"
                className="w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={resetRequestForm}>Cancel</Button>
              <Button size="sm" onClick={submitLocationRequest} disabled={submittingReq}>
                {submittingReq ? "Sending…" : "Send request"}
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="AI receptionist">
        <div className="px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1.5">Voice</div>
          <select
            value={aiVoiceId}
            onChange={(e) => setAiVoiceId(e.target.value)}
            className="w-full h-9 rounded-md bg-input border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <div className="text-[10px] text-muted-foreground mt-2">
            Greeting and personality are managed by your account team to keep call quality consistent. Need a tweak? Reach out in Support.
          </div>
        </div>
        <div className="px-4 py-3 flex justify-end">
          <Button size="sm" onClick={saveAi} disabled={savingAi || !companyId}>
            {savingAi ? "Saving…" : "Save voice"}
          </Button>
        </div>
      </Section>

      <Section title="Services">
        <ul className="px-4 py-2">
          {services.map((s, i) => (
            <li key={s + i} className="flex items-center justify-between py-1.5">
              <span className="text-sm">{s}</span>
              <button onClick={() => setServices((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 pb-3 flex gap-2">
          <Input
            value={newSvc}
            onChange={(e) => setNewSvc(e.target.value)}
            placeholder="Add service"
            className="h-9"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
          />
          <Button size="sm" onClick={addService}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      </Section>

      <Section title="Appearance">
        <Toggle
          label="Dark mode"
          hint="Easy on the eyes"
          checked={darkMode}
          onChange={(v) => {
            setDarkMode(v);
            setTheme(v ? "dark" : "light");
            toast.success(v ? "Dark mode on" : "Light mode on");
          }}
        />
      </Section>

      <Section title="Notifications">
        <Toggle label="Push notifications" hint="On this device" checked={notifPush} onChange={setNotifPush} />
        <Toggle label="New lead" hint="Instant alert when a caller becomes a lead" checked={notifNewLead} onChange={setNotifNewLead} />
        <Toggle label="Appointment booked" hint="When AI books a slot" checked={notifBooking} onChange={setNotifBooking} />
        <Toggle label="Missed call" hint="Caller hung up — auto SMS sent" checked={notifMissed} onChange={setNotifMissed} />
        <Toggle label="Daily 9am summary" hint="Yesterday's recap by email" checked={notifDaily} onChange={setNotifDaily} />
        <Toggle label="Weekly performance report" hint="Mondays by email" checked={notifWeekly} onChange={setNotifWeekly} />
      </Section>

      <Section title="Security">
        <Toggle
          label="Two-factor authentication"
          hint="Require a code from your phone at sign-in"
          checked={twoFA}
          onChange={(v) => { setTwoFA(v); toast.success(v ? "2FA enabled (demo)" : "2FA disabled"); }}
        />
        <div className="px-4 py-3.5 flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-success/15 text-success flex items-center justify-center">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="flex-1 text-xs text-muted-foreground">
            All data encrypted end-to-end. View session activity in your account.
          </div>
        </div>
      </Section>

      <Section title="Team access">
        <ul className="px-4 py-2 divide-y divide-border/60">
          {team.map((t, i) => (
            <li key={t.email} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {t.email[0].toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-sm truncate">{t.email}</div>
                  <div className="text-[10px] text-muted-foreground">{t.role}</div>
                </div>
              </div>
              {t.role !== "Owner" && (
                <button
                  onClick={() => setTeam((p) => p.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="px-4 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Mail className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={teamEmail}
              onChange={(e) => setTeamEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="h-9 pl-8"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), inviteTeammate())}
            />
          </div>
          <Button size="sm" onClick={inviteTeammate}>
            <UserPlus className="h-3.5 w-3.5" /> Invite
          </Button>
        </div>
      </Section>

      <Section title="White label (Enterprise)">
        <Toggle
          label="Use my own branding"
          hint="Replace SGS branding with your own across the app"
          checked={whiteLabel}
          onChange={(v) => { setWhiteLabel(v); toast.success(v ? "White-label enabled (demo)" : "Reverted to default branding"); }}
        />
        {whiteLabel && (
          <div className="px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <Palette className="h-3 w-3" /> Brand name
            </div>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="h-9 bg-input" />
          </div>
        )}
      </Section>

      <Section title="Integrations">
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-8 w-8 rounded-full bg-accent/15 text-accent flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">Zapier</div>
              <div className="text-[11px] text-muted-foreground">Send leads to HubSpot, Salesforce, Sheets, and 5,000+ apps</div>
            </div>
          </div>
          <Input
            value={zapHook}
            onChange={(e) => setZapHook(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
            className="h-9 bg-input"
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            disabled={!zapHook.trim()}
            onClick={() => toast.success("Test event sent (demo)")}
          >
            Send test event
          </Button>
        </div>
      </Section>

      <Section title="Active sessions">
        <ul className="px-4 py-2 divide-y divide-border/60">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <span className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                {s.device.includes("iPhone") ? (
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  {s.device}
                  {s.current && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success">This device</span>}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{s.location} · {s.ip} · {fmtRel(s.at)}</div>
              </div>
              {!s.current && (
                <button
                  onClick={() => toast.success("Session revoked (demo)")}
                  className="text-[11px] text-destructive hover:underline"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <div className="flex justify-end mb-6">
        <Button onClick={() => toast.success("Settings saved")} size="sm">Save changes</Button>
      </div>

      <a
        href="https://gain-and-give-hub.lovable.app"
        target="_blank"
        rel="noreferrer"
        className="glass rounded-2xl p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors mb-3"
      >
        <div>
          <div className="font-medium">Visit website</div>
          <div className="text-xs text-muted-foreground">gain-and-give-hub.lovable.app</div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </a>

      <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="text-center text-[11px] text-muted-foreground mt-8">
        SGS · v0.1 · Powered by Lovable Cloud
      </p>
    </AppShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-4">
    <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</h2>
    <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">{children}</div>
  </div>
);

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="px-4 py-3">
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 bg-input" />
  </div>
);

const Toggle = ({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between px-4 py-3.5">
    <div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default Settings;
