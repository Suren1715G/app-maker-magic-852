import { Eye, X } from "lucide-react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useNavigate } from "react-router-dom";

export function DemoBanner() {
  const { demoMode, setDemoMode } = useDemoMode();
  const navigate = useNavigate();

  if (!demoMode) return null;

  const exit = () => {
    setDemoMode(false);
    navigate("/master", { replace: true });
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground text-xs font-medium">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          Demo view — this is what customers see
        </span>
        <button
          type="button"
          onClick={exit}
          className="flex items-center gap-1 underline-offset-2 hover:underline"
        >
          Exit <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}