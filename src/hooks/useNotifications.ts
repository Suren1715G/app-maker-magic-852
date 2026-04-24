import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type DbNotification = {
  id: string;
  company_id: string;
  user_id: string | null;
  type: "lead" | "booking" | "missed" | "review" | "summary" | "sms" | "note" | "system";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function useNotifications() {
  const { companyId, user } = useAuth();
  const [items, setItems] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (!error && data) setItems(data as DbNotification[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`notifications:${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `company_id=eq.${companyId}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as DbNotification;
              if (n.user_id && user?.id && n.user_id !== user.id) return prev;
              if (prev.some((x) => x.id === n.id)) return prev;
              return [n, ...prev].slice(0, 100);
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as DbNotification;
              return prev.map((x) => (x.id === n.id ? n : x));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              return prev.filter((x) => x.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [companyId, user?.id]);

  const markAllRead = async () => {
    if (!companyId) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  };

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  return { items, loading, markAllRead, markRead, unreadCount: items.filter((n) => !n.read).length };
}

type Prefs = {
  push: boolean;
  email: boolean;
  daily_summary: boolean;
  missed_call: boolean;
  new_review: boolean;
  new_lead: boolean;
  new_sms: boolean;
};

const DEFAULT_PREFS: Prefs = {
  push: true,
  email: true,
  daily_summary: true,
  missed_call: true,
  new_review: false,
  new_lead: true,
  new_sms: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setPrefs({
          push: data.push,
          email: data.email,
          daily_summary: data.daily_summary,
          missed_call: data.missed_call,
          new_review: data.new_review,
          new_lead: data.new_lead,
          new_sms: data.new_sms,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const update = async (patch: Partial<Prefs>) => {
    if (!user?.id) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
  };

  return { prefs, loading, update };
}