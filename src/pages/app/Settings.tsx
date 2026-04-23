import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ExternalLink, LogOut, Plus, Trash2, Upload, ShieldCheck, UserPlus, Mail, Palette, Zap, Monitor, Smartphone } from "lucide-react";
import { sessions } from "@/data/mock";
import { fmtRel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("+1 (844) 790-5754");
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [voice, setVoice] = useState("Aria · Friendly");
  const [greeting, setGreeting] = useState("Hi! You've reached SGS. How can I help today?");
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

      <Section title="AI">
        <Field label="Voice" value={voice} onChange={setVoice} />
        <div className="px-4 py-3.5">
          <div className="text-xs text-muted-foreground mb-1.5">Custom greeting</div>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
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
