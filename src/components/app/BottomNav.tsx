import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Phone, CalendarDays, MessageSquare, Users,
  Star, BarChart3, Bell, CreditCard, Gift, Bot, LifeBuoy, Settings, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const primary = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/sms", label: "Messages", icon: MessageSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
];

const more = [
  { to: "/leads", label: "Leads (CRM)", icon: Users, hint: "Pipeline & notes" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, hint: "Charts & ROI" },
  { to: "/reviews", label: "Reviews", icon: Star, hint: "Google reviews" },
  { to: "/notifications", label: "Notifications", icon: Bell, hint: "Alerts & prefs" },
  { to: "/assistant", label: "AI Assistant", icon: Bot, hint: "Ask your data" },
  { to: "/billing", label: "Billing", icon: CreditCard, hint: "Plan & invoices" },
  { to: "/referrals", label: "Referrals", icon: Gift, hint: "Earn free months" },
  { to: "/support", label: "Support", icon: LifeBuoy, hint: "Help & FAQ" },
  { to: "/settings", label: "Settings", icon: Settings, hint: "Business & AI" },
];

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const moreActive = more.some((m) => location.pathname === m.to || location.pathname.startsWith(m.to + "/"));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong safe-bottom border-t border-border/60">
      <ul className="grid grid-cols-5 max-w-md md:max-w-3xl lg:max-w-5xl mx-auto">
        {primary.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-all", isActive && "bg-primary/15 glow-primary")}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "w-full flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-all", moreActive && "bg-primary/15 glow-primary")}>
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                </span>
                More
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-display text-xl">All tools</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {more.map((m) => (
                  <li key={m.to}>
                    <NavLink
                      to={m.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) => cn(
                        "block rounded-2xl p-3 border border-border/60 transition-colors",
                        isActive ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                          <m.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{m.hint}</div>
                        </div>
                      </div>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
