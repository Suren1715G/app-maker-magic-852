import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import type { TourStep } from "./tourSteps";

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

const PAD = 8;

export function TourOverlay({ step, stepIndex, totalSteps, onNext, onPrev, onSkip }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [tick, setTick] = useState(0);

  // Re-measure target on step change, scroll, resize, and animation frames for ~600ms
  useEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const start = performance.now();

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(step.target!);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        // scroll into view if off-screen
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        setRect(null);
      }
      if (performance.now() - start < 700) {
        raf = requestAnimationFrame(measure);
      }
    };
    measure();

    const onWin = () => setTick((t) => t + 1);
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [step.target, stepIndex, tick]);

  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  // Determine tooltip position
  const tooltipStyle: React.CSSProperties = (() => {
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const tooltipW = 340;
    const tooltipH = 200;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > tooltipH + 40;
    const top = placeBelow
      ? Math.min(rect.top + rect.height + PAD + 8, window.innerHeight - tooltipH - 16)
      : Math.max(16, rect.top - tooltipH - PAD - 8);
    const left = Math.min(
      Math.max(16, rect.left + rect.width / 2 - tooltipW / 2),
      window.innerWidth - tooltipW - 16
    );
    return { top, left, width: tooltipW };
  })();

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {/* Backdrop with cutout */}
      {rect ? (
        <svg className="absolute inset-0 w-full h-full pointer-events-auto">
          <defs>
            <mask id="tour-cutout">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx="14"
                ry="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="hsl(var(--background) / 0.78)" mask="url(#tour-cutout)" />
          <rect
            x={rect.left - PAD}
            y={rect.top - PAD}
            width={rect.width + PAD * 2}
            height={rect.height + PAD * 2}
            rx="14"
            ry="14"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="animate-pulse"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute pointer-events-auto rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl p-5 animate-fade-in"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Step {stepIndex + 1} of {totalSteps}
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-display text-lg font-semibold leading-tight mb-1.5">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.body}</p>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-secondary mb-4 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={onPrev}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={onNext}>
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}