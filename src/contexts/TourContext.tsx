import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { TOUR_STEPS } from "@/components/tour/tourSteps";
import { TourOverlay } from "@/components/tour/TourOverlay";

type TourCtx = {
  active: boolean;
  start: () => void;
  stop: () => void;
};

const Ctx = createContext<TourCtx>({ active: false, start: () => {}, stop: () => {} });

const SEEN_KEY = "tour:getStarted:seen:v1";

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const autoStarted = useRef(false);

  const start = useCallback(() => {
    setStepIdx(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  // Auto-start on first login
  useEffect(() => {
    if (!user || autoStarted.current) return;
    let seen = "1";
    try {
      seen = localStorage.getItem(SEEN_KEY) || "";
    } catch {}
    if (!seen) {
      autoStarted.current = true;
      // Small delay so the dashboard renders first
      const t = setTimeout(() => start(), 800);
      return () => clearTimeout(t);
    }
  }, [user, start]);

  // Navigate to the route this step needs
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIdx];
    if (step?.route && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [active, stepIdx, location.pathname, navigate]);

  const next = () => {
    setStepIdx((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        stop();
        return i;
      }
      return i + 1;
    });
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  return (
    <Ctx.Provider value={{ active, start, stop }}>
      {children}
      {active && (
        <TourOverlay
          step={TOUR_STEPS[stepIdx]}
          stepIndex={stepIdx}
          totalSteps={TOUR_STEPS.length}
          onNext={next}
          onPrev={prev}
          onSkip={stop}
        />
      )}
    </Ctx.Provider>
  );
}

export const useTour = () => useContext(Ctx);