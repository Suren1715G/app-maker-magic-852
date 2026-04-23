import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Bell, ExternalLink, Globe, LogOut, MessageSquare, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const rows = [
  { icon: Phone, label: "Phone number", value: "+1 (415) 555-SGS1" },
  { icon: Globe, label: "Business hours", value: "24/7 — always on" },
  { icon: MessageSquare, label: "SMS sender", value: "+1 (415) 555-SGS1" },
  { icon: Bell, label: "Push notifications", value: "On" },
  { icon: Sparkles, label: "AI voice", value: "Aria · Friendly" },
];

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
          <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold">
            {(user.email?.[0] || "?").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="text-sm font-medium truncate">{user.email}</div>
          </div>
        </div>
      )}

      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden mb-6">
        {rows.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-center gap-3 px-4 py-3.5">
            <span className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-sm font-medium truncate">{value}</div>
            </div>
          </li>
        ))}
      </ul>

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

export default Settings;
