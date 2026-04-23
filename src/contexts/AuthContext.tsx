import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  companyId: string | null;
  roleLoading: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  const loadRole = async (uid: string | undefined) => {
    if (!uid) {
      setIsAdmin(false);
      setCompanyId(null);
      return;
    }
    setRoleLoading(true);
    try {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("company_id").eq("user_id", uid).maybeSingle(),
      ]);
      setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
      setCompanyId(profile?.company_id ?? null);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    // Listener FIRST, then getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // Defer role fetch to avoid deadlocks inside the auth callback
      setTimeout(() => loadRole(s?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      loadRole(s?.user?.id);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    await loadRole(user?.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, isAdmin, companyId, roleLoading, refreshRole, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
