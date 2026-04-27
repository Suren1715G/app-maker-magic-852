import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { locations as mockLocations, type Location } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { supabase } from "@/integrations/supabase/client";

type Value = {
  active: Location | "all";
  setActive: (l: Location | "all") => void;
  list: Location[];
  isDemo: boolean;
  loading: boolean;
};

const Ctx = createContext<Value | undefined>(undefined);

const activeKey = (uid: string | null | undefined) => `sgs.locations.active.${uid ?? "anon"}`;

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, companyId } = useAuth();
  const { demoMode } = useDemoMode();
  const isDemo = demoMode;

  const [realList, setRealList] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActiveState] = useState<Location | "all">("all");

  // Persist the user's active selection across reloads.
  const setActive: Value["setActive"] = (l) => {
    setActiveState(l);
    try {
      localStorage.setItem(activeKey(user?.id), l === "all" ? "all" : l.id);
    } catch {
      /* ignore */
    }
  };

  // Load real locations from approved phone numbers (one row per location).
  useEffect(() => {
    if (isDemo) return;
    if (!companyId) {
      setRealList([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("company_phone_numbers")
        .select("id, label, phone_number, status, created_at")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const rows = (data ?? []).map<Location>((r, i) => ({
        id: r.id,
        name: r.label?.trim() || `Location ${i + 1}`,
        address: r.phone_number,
        callsToday: 0,
        bookingsToday: 0,
        isPrimary: i === 0,
      }));
      setRealList(rows);
      setLoading(false);
    };
    load();

    // Refresh when phone numbers change (owner activates a new one).
    const channel = supabase
      .channel(`company_phone_numbers:${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_phone_numbers", filter: `company_id=eq.${companyId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [companyId, isDemo]);

  const list = useMemo<Location[]>(() => (isDemo ? mockLocations : realList), [isDemo, realList]);

  // Restore the persisted selection when the list (or user) changes.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(activeKey(user?.id));
    } catch {
      /* ignore */
    }
    if (saved && saved !== "all") {
      const match = list.find((l) => l.id === saved);
      if (match) {
        setActiveState(match);
        return;
      }
    }
    // Default: combined dashboard ("all") whenever there are 2+ locations,
    // otherwise focus the only location so the dashboard isn't empty.
    setActiveState(list.length === 1 ? list[0] : "all");
  }, [list, user?.id]);

  return (
    <Ctx.Provider value={{ active, setActive, list, isDemo, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLocationCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocationCtx must be inside LocationProvider");
  return v;
}
