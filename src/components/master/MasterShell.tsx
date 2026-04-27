import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Building2,
  KeyRound,
  LogOut,
  Eye,
  Sparkles,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { toast } from "sonner";

const items = [
  { to: "/master", end: true, label: "Overview", icon: LayoutGrid },
  { to: "/master/companies", label: "Companies", icon: Building2 },
  { to: "/master/support", label: "Support", icon: Inbox },
  { to: "/master/codes", label: "Access codes", icon: KeyRound },
];

export function MasterShell({
  children,
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { setDemoMode } = useDemoMode();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out.");
    navigate("/auth", { replace: true });
  };

  const enterDemo = () => {
    setDemoMode(true);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 bg-secondary/20 backdrop-blur-sm">
        <div className="px-5 py-6 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl glow-primary overflow-hidden">
            <img src="/icon-192.png" alt="SGS" className="h-full w-full" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm leading-tight">
              <span className="prism-text">SGS</span> Owner
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Master panel
            </div>
          </div>
        </div>

        <nav className="px-3 flex-1 space-y-1">
          {items.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 space-y-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={enterDemo}
          >
            <Eye className="h-4 w-4" /> Customer demo view
          </Button>
          {user && (
            <div className="px-2 pt-2 text-[11px] text-muted-foreground truncate">
              {user.email}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 glass-strong border-b border-border/60 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm">
              <span className="prism-text">SGS</span> Owner
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={enterDemo}>
            <Eye className="h-3.5 w-3.5" /> Demo
          </Button>
        </header>

        <main className="flex-1 px-5 md:px-10 py-6 md:py-10 max-w-6xl w-full mx-auto animate-slide-up">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-8">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {right}
          </header>
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-border/60 safe-bottom">
          <ul className="grid grid-cols-4">
            {items.map(({ to, end, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}