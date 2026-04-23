import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { DemoBanner } from "./DemoBanner";
import { useDemoMode } from "@/contexts/DemoModeContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { demoMode } = useDemoMode();
  return (
    <div className="min-h-screen w-full max-w-md mx-auto relative">
      <DemoBanner />
      <main className={`pb-28 safe-top px-5 animate-slide-up ${demoMode ? "pt-10" : ""}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between pt-4 pb-6">
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
