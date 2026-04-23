import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { locations as mockLocations, type Location } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";

type Value = {
  active: Location | "all";
  setActive: (l: Location | "all") => void;
  list: Location[];
  addLocation: (input: { name: string; address: string }) => void;
  removeLocation: (id: string) => void;
  isDemo: boolean;
};

const Ctx = createContext<Value | undefined>(undefined);

const storageKey = (uid: string | null | undefined) => `sgs.locations.${uid ?? "anon"}`;

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { demoMode } = useDemoMode();
  const isDemo = demoMode; // admins viewing customer demo see mock data

  const [userList, setUserList] = useState<Location[]>([]);
  const [active, setActive] = useState<Location | "all">("all");

  // Load user-owned list from localStorage on user change
  useEffect(() => {
    if (isDemo) return;
    try {
      const raw = localStorage.getItem(storageKey(user?.id));
      const parsed: Location[] = raw ? JSON.parse(raw) : [];
      setUserList(parsed);
      setActive(parsed[0] ?? "all");
    } catch {
      setUserList([]);
      setActive("all");
    }
  }, [user?.id, isDemo]);

  // Persist
  useEffect(() => {
    if (isDemo) return;
    try {
      localStorage.setItem(storageKey(user?.id), JSON.stringify(userList));
    } catch {
      /* ignore */
    }
  }, [userList, user?.id, isDemo]);

  const list = useMemo<Location[]>(() => (isDemo ? mockLocations : userList), [isDemo, userList]);

  // Keep active valid as list changes
  useEffect(() => {
    if (active === "all") return;
    if (!list.some((l) => l.id === active.id)) {
      setActive(list[0] ?? "all");
    }
  }, [list, active]);

  const addLocation: Value["addLocation"] = ({ name, address }) => {
    const loc: Location = {
      id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      address: address.trim(),
      callsToday: 0,
      bookingsToday: 0,
      isPrimary: userList.length === 0,
    };
    setUserList((p) => [...p, loc]);
    setActive(loc);
  };

  const removeLocation: Value["removeLocation"] = (id) => {
    setUserList((p) => {
      const next = p.filter((l) => l.id !== id);
      // Make sure exactly one primary remains if any exist
      if (next.length && !next.some((l) => l.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  return (
    <Ctx.Provider value={{ active, setActive, list, addLocation, removeLocation, isDemo }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLocationCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocationCtx must be inside LocationProvider");
  return v;
}
