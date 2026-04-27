import { ReactNode, useEffect, useState } from "react";
import { BottomNav } from "./BottomNav";
import { DemoBanner } from "./DemoBanner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { LocationSwitcher } from "./LocationSwitcher";
import { WifiOff } from "lucide-react";
import { CubesBackground } from "./CubesBackground";

export function AppShell({ children }: { children: ReactNode }) {
  const { demoMode } = useDemoMode();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto relative">
      <CubesBackground />
      <DemoBanner />
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-accent text-accent-foreground text-[11px] font-medium">
          <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-1.5 justify-center">
            <WifiOff className="h-3 w-3" /> Offline — viewing cached data
          </div>
        </div>
      )}
      <div className={`fixed right-3 md:right-6 z-30 ${demoMode ? "top-11" : "top-3"}`}>
        <LocationSwitcher />
      </div>
      <main className={`pb-28 safe-top px-5 md:px-8 lg:px-12 animate-slide-up ${demoMode ? "pt-10" : ""}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header data-tour="page-header" className="flex items-end justify-between pt-4 pb-6">
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
