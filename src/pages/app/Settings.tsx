import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ExternalLink, LogOut, Plus, Trash2, Upload, ShieldCheck, UserPlus, Mail, Palette, Zap, Monitor, Smartphone, MapPin, Phone as PhoneIcon, Clock } from "lucide-react";
import { sessions } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const VOICE_OPTIONS: { id: string; label: string }[] = [
  { id: "9BWtsMINqrJLrRacOk9x", label: "Aria · Friendly female" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · Warm female" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura · Upbeat female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George · Calm male" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam · Confident male" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian · Deep male" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica · Energetic female" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris · Casual male" },
];

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("+1 (844) 790-5754");
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [greeting, setGreeting] = useState("Hi! You've reached SGS. How can I help today?");
  const [aiPrompt, setAiPrompt] = useState(
    "You are a friendly AI receptionist. Greet callers warmly, answer questions about our services, qualify leads, and offer to book an appointment. Keep replies under two sentences.",
  );
  const [aiVoiceId, setAiVoiceId] = useState<string>(VOICE_OPTIONS[0].id);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [savingAi, setSavingAi] = useState(false);

  // Locations (phone numbers per location, stored in company_phone_numbers)
  type LocationRow = {
    id: string;
    label: string | null;
    phone_number: string;
    status: "pending" | "active" | "disabled";
    created_at: string;
  };
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [newLocLabel, setNewLocLabel] = useState("");
  const [newLocPhone, setNewLocPhone] = useState("");
  const [addingLoc, setAddingLoc] = useState(false);

  const [services, setServices] = useState(["Deep Clean", "Move-out Clean", "Office Clean", "Standard Clean"]);
  const [newSvc, setNewSvc] = useState("");
  const [darkMode, setDarkMode] = useState(true);
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
        .select("ai_system_prompt, ai_first_message, ai_voice_id")
        .eq("id", profile.company_id)
        .maybeSingle();
      if (company?.ai_system_prompt) setAiPrompt(company.ai_system_prompt);
      if (company?.ai_first_message) setGreeting(company.ai_first_message);
      if (company?.ai_voice_id) setAiVoiceId(company.ai_voice_id);
      await loadLocations(profile.company_id);
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

  const addLocation = async () => {
    if (!companyId) {
      toast.error("No company linked to your account");
      return;
    }
    const label = newLocLabel.trim();
    const number = newLocPhone.trim();
    if (!label) return toast.error("Give the location a name");
    if (!/^\+?[0-9 ()\-]{7,20}$/.test(number)) return toast.error("Enter a valid phone number");
    setAddingLoc(true);
    const { error } = await supabase.from("company_phone_numbers").insert({
      company_id: companyId,
      label,
      phone_number: number,
      provider: "twilio",
      status: "pending",
      requested_by: user?.id,
    });
    setAddingLoc(false);
    if (error) {
      if (error.message?.includes("duplicate")) {
        toast.error("That phone number is already in use");
      } else {
        toast.error(error.message ?? "Could not add location");
      }
      return;
    }
    toast.success("Location requested — we'll activate it shortly");
    setNewLocLabel("");
    setNewLocPhone("");
    await loadLocations(companyId);
  };

  const removePendingLocation = async (id: string) => {
    const { error } = await supabase.from("company_phone_numbers").delete().eq("id", id);
    if (error) {
      toast.error("Could not remove — only pending locations can be deleted");
      return;
    }
    toast.success("Location removed");
    if (companyId) await loadLocations(companyId);
  };

  const saveAi = async () => {
    if (!companyId) {
      toast.error("No company linked to your account");
      return;
    }
    setSavingAi(true);
    const { error } = await supabase
      .from("companies")
      .update({
        ai_system_prompt: aiPrompt,
        ai_first_message: greeting,
        ai_voice_id: aiVoiceId,
      })
      .eq("id", companyId);
    setSavingAi(false);
    if (error) {
      toast.error("Failed to save AI settings");
    } else {
      toast.success("AI receptionist updated");
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
        <div className="px-4 py-3 text-[11px] text-muted-foreground">
          Add a phone number for each business location. New numbers stay <span className="text-foreground font-medium">pending</span> until our team activates routing — usually within 1 business day.
        </div>
        {locations.length > 0 && (
          <ul className="px-4 pb-2 divide-y divide-border/60">
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
                  {l.status === "pending" && (
                    <button
                      onClick={() => removePendingLocation(l.id)}
                      className="text-muted-foreground hover:text-destructive ml-1"
                      aria-label="Remove pending location"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-4 pb-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <div className="relative">
            <MapPin className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={newLocLabel}
              onChange={(e) => setNewLocLabel(e.target.value)}
              placeholder="Location name"
              className="h-9 pl-8"
              maxLength={60}
            />
          </div>
          <div className="relative">
            <PhoneIcon className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={newLocPhone}
              onChange={(e) => setNewLocPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="h-9 pl-8"
              maxLength={20}
              inputMode="tel"
            />
          </div>
          <Button size="sm" onClick={addLocation} disabled={addingLoc || !companyId}>
            <Plus className="h-3.5 w-3.5" /> {addingLoc ? "Adding…" : "Add location"}
          </Button>
        </div>
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
        </div>
        <div className="px-4 py-3.5">
          <div className="text-xs text-muted-foreground mb-1.5">Greeting</div>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={2}
            placeholder="Hi! Thanks for calling. How can I help today?"
            className="w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            Tip: use <code>{"{business}"}</code> to insert your business name.
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="text-xs text-muted-foreground mb-1.5">Personality &amp; instructions</div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={5}
            placeholder="Describe how the AI should behave, what services you offer, your hours, pricing, booking rules…"
            className="w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="px-4 py-3 flex justify-end">
          <Button size="sm" onClick={saveAi} disabled={savingAi || !companyId}>
            {savingAi ? "Saving…" : "Save AI settings"}
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
        <Toggle label="Dark mode" hint="Easy on the eyes" checked={darkMode} onChange={setDarkMode} />
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
