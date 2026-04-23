import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { ExternalLink, LogOut, Plus, Trash2, Upload } from "lucide-react";
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
  const [hours, setHours] = useState("24/7 — always on");
  const [voice, setVoice] = useState("Aria · Friendly");
  const [greeting, setGreeting] = useState("Hi! You've reached SGS. How can I help today?");
  const [services, setServices] = useState(["Deep Clean", "Move-out Clean", "Office Clean", "Standard Clean"]);
  const [newSvc, setNewSvc] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);

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
        <Field label="Business hours" value={hours} onChange={setHours} />
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
