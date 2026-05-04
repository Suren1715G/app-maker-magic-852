import { supabase } from "@/integrations/supabase/client";

export async function getFreshAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Your login expired. Please sign in again.");
  }

  const expiresSoon = session.expires_at
    ? session.expires_at * 1000 < Date.now() + 60_000
    : false;

  if (expiresSoon) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      await supabase.auth.signOut();
      throw new Error("Your login expired. Please sign in again.");
    }
    return data.session.access_token;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) return session.access_token;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !data.session) {
    await supabase.auth.signOut();
    throw new Error("Your login expired. Please sign in again.");
  }

  return data.session.access_token;
}