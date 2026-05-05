import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, companyId, isAdmin, roleLoading } = useAuth();
  const { demoMode } = useDemoMode();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace state={{ from: location }} />;
  }

  // Admins normally live in /master. Send them there unless they've explicitly
  // entered "customer demo view" from the master sidebar.
  if (isAdmin && !demoMode) {
    return <Navigate to="/master" replace />;
  }

  // Users with no company link (e.g. fresh Google sign-in) must enter their code first.
  if (!companyId && !isAdmin && location.pathname !== "/claim") {
    return <Navigate to="/claim" replace />;
  }

  return <>{children}</>;
}
