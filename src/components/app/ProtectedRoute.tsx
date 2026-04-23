import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, companyId, isAdmin, roleLoading } = useAuth();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Users with no company link (e.g. fresh Google sign-in) must enter their code first.
  // Admins are exempt — they manage codes, not consume them.
  if (!companyId && !isAdmin && location.pathname !== "/claim") {
    return <Navigate to="/claim" replace />;
  }

  return <>{children}</>;
}
