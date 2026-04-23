import { createContext, useContext, useState, ReactNode, useEffect } from "react";

type DemoModeValue = {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
};

const DemoModeContext = createContext<DemoModeValue | undefined>(undefined);

const STORAGE_KEY = "sgs.demo_mode";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (demoMode) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [demoMode]);

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode: setDemoModeState }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error("useDemoMode must be used inside DemoModeProvider");
  return ctx;
}