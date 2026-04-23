import { createContext, useContext, useState, ReactNode } from "react";
import { locations, type Location } from "@/data/mock";

type Value = {
  active: Location | "all";
  setActive: (l: Location | "all") => void;
  list: Location[];
};

const Ctx = createContext<Value | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Location | "all">(locations[0]);
  return (
    <Ctx.Provider value={{ active, setActive, list: locations }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLocationCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocationCtx must be inside LocationProvider");
  return v;
}