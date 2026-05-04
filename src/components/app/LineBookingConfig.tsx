import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Loader2, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Per-line booking config. Used in Customer Settings and Master.
 * - admin=false: company_admin editing their own company's line
 * - admin=true:  master admin editing any company's line
 */

type LineRow = {
  id: string;
  label: string | null;
  phone_number: string;
  booking_provider: "none" | "google" | "acuity";
  shared_calendar_id: string | null;
  shared_calendar_summary: string | null;
  shared_calendar_owner_user_id: string | null;
  acuity_appointment_type_id: string | null;
};

type GoogleOwner = {
  user_id: string;
  display_name: string | null;
  google_email: string | null;
};

type Calendar = { id: string; summary: string; primary?: boolean };

type CompanyAcuity = {
  acuity_user_id: string | null;
  acuity_api_key: string | null;
};

export function LineBookingConfig({
  line,
  companyId,
  admin = false,
  onChanged,
}: {
  line: LineRow;
  companyId: string;
  admin?: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const [googleOpen, setGoogleOpen] = useState(false);
  const [changeCalOpen, setChangeCalOpen] = useState(false);
  const [owners, setOwners] = useState<GoogleOwner[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarId, setCalendarId] = useState<string>("");
  const [loadingCals, setLoadingCals] = useState(false);

  const [acuOpen, setAcuOpen] = useState(false);
  const [acuType, setAcuType] = useState("");
  const [companyAcuity, setCompanyAcuity] = useState<CompanyAcuity | null>(null);

  // Load Google owner candidates (anyone in the company who has connected Google)
  const openGoogle = async () => {
    setBusy(true);
    try {
      // 1. Profiles in this company
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("company_id", companyId);
      if (pErr) throw pErr;

      const userIds = (profiles ?? []).map((p) => p.user_id);
      if (userIds.length === 0) {
        toast.error("No team members found");
        return;
      }

      // 2. Of those, who has Google tokens
      const { data: tokens, error: tErr } = await supabase
        .from("user_google_tokens")
        .select("user_id, google_email")
        .in("user_id", userIds);
      if (tErr) throw tErr;

      const list: GoogleOwner[] = (tokens ?? []).map((t) => {
        const p = (profiles ?? []).find((pp) => pp.user_id === t.user_id);
        return {
          user_id: t.user_id,
          display_name: p?.display_name ?? null,
          google_email: t.google_email ?? null,
        };
      });

      if (list.length === 0) {
        toast.error("No team member has connected a Google account yet. Connect Google on the Calendar page first.");
        return;
      }
      setOwners(list);
      setOwnerId(line.shared_calendar_owner_user_id ?? list[0].user_id);
      setCalendars([]);
      setCalendarId(line.shared_calendar_id ?? "");
      setGoogleOpen(true);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load Google accounts");
    } finally {
      setBusy(false);
    }
  };

  // When the picked owner changes, fetch THEIR calendars.
  // Note: list_my_calendars in google-calendar edge fn returns the *caller's*
  // calendars. To enumerate someone else's calendars we'd need a dedicated
  // admin endpoint. For now: only the owner themselves can pick the calendar
  // (they sign in, open this dialog, pick from their list). Other team
  // members can choose THE SAME owner but are stuck with the previously
  // chosen calendarId until that owner re-picks.
  useEffect(() => {
    if (!googleOpen || !ownerId) return;
    (async () => {
      setLoadingCals(true);
      const { data: { user } } = await supabase.auth.getUser();
      // If the picked owner is the current logged-in user, use their own
      // calendars. Otherwise (picking the line's already-connected owner —
      // including a synthetic admin-connected owner), use the line endpoint
      // which authenticates against the stored tokens for that line.
      let res;
      if (user?.id === ownerId) {
        res = await supabase.functions.invoke("google-calendar", {
          body: { action: "list_my_calendars" },
        });
      } else if (ownerId === line.shared_calendar_owner_user_id) {
        res = await supabase.functions.invoke("google-calendar", {
          body: { action: "list_line_calendars", line_id: line.id },
        });
      } else {
        setCalendars([]);
        setLoadingCals(false);
        return;
      }
      const { data, error } = res;
      setLoadingCals(false);
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Failed to load calendars");
        return;
      }
      setCalendars((data?.items ?? []) as Calendar[]);
    })();
  }, [googleOpen, ownerId, line.id, line.shared_calendar_owner_user_id]);

  // "Change calendar" — for lines already connected to Google, just list
  // calendars from the line's stored owner tokens and save back.
  const openChangeCalendar = async () => {
    setBusy(true);
    setLoadingCals(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: { action: "list_line_calendars", line_id: line.id },
      });
      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? "Failed");
      }
      setCalendars((data?.items ?? []) as Calendar[]);
      setCalendarId(line.shared_calendar_id ?? "");
      setChangeCalOpen(true);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load calendars");
    } finally {
      setLoadingCals(false);
      setBusy(false);
    }
  };

  const saveChangeCalendar = async () => {
    if (!calendarId || !line.shared_calendar_owner_user_id) return;
    const cal = calendars.find((c) => c.id === calendarId);
    setBusy(true);
    try {
      await callRpc(admin ? "admin_set_line_google" : "company_set_line_google", {
        _line_id: line.id,
        _owner_user_id: line.shared_calendar_owner_user_id,
        _calendar_id: calendarId,
        _calendar_summary: cal?.summary ?? null,
      });
      toast.success("Calendar updated");
      setChangeCalOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const callRpc = async (name: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(name as any, args as any);
    if (error) throw error;
  };

  const saveGoogle = async () => {
    if (!calendarId) {
      toast.error("Pick a calendar");
      return;
    }
    const cal = calendars.find((c) => c.id === calendarId);
    setBusy(true);
    try {
      await callRpc(admin ? "admin_set_line_google" : "company_set_line_google", {
        _line_id: line.id,
        _owner_user_id: ownerId,
        _calendar_id: calendarId,
        _calendar_summary: cal?.summary ?? null,
      });
      toast.success("Calendar set for this line");
      setGoogleOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const openAcuity = async () => {
    setBusy(true);
    try {
      const { data } = await supabase
        .from("companies")
        .select("acuity_user_id, acuity_api_key")
        .eq("id", companyId)
        .maybeSingle();
      setCompanyAcuity((data as CompanyAcuity) ?? null);
      setAcuType(line.acuity_appointment_type_id ?? "");
      setAcuOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const saveAcuity = async () => {
    if (!acuType.trim()) {
      toast.error("Appointment type ID required");
      return;
    }
    setBusy(true);
    try {
      await callRpc(admin ? "admin_set_line_acuity" : "company_set_line_acuity", {
        _line_id: line.id,
        _appointment_type_id: acuType.trim(),
      });
      toast.success("Acuity set for this line");
      setAcuOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirm("Clear booking integration for this line?")) return;
    setBusy(true);
    try {
      await callRpc(admin ? "admin_clear_line_booking" : "company_clear_line_booking", {
        _line_id: line.id,
      });
      toast.success("Cleared");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const connectNewGoogleForLine = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-google-oauth-start`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: companyId,
          line_id: line.id,
          return_to: `${window.location.origin}${window.location.pathname}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      window.location.href = json.url;
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start Google OAuth");
    } finally {
      setBusy(false);
    }
  };

  const provider = line.booking_provider;

  return (
    <div className="rounded-lg border border-border/60 p-3 bg-secondary/20">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Booking calendar for this line</span>
        <span
          className={`ml-auto text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
            provider === "none"
              ? "bg-destructive/15 text-destructive"
              : "bg-success/15 text-success"
          }`}
        >
          {provider === "none" ? "Not set" : provider}
        </span>
      </div>

      {provider === "google" && (
        <div className="text-[11px] text-muted-foreground mb-2 break-all">
          {line.shared_calendar_summary ?? line.shared_calendar_id}
        </div>
      )}
      {provider === "acuity" && (
        <div className="text-[11px] text-muted-foreground mb-2">
          Appointment type · {line.acuity_appointment_type_id}
        </div>
      )}
      {provider === "none" && (
        <div className="text-[11px] text-muted-foreground mb-2">
          The AI receptionist won't be able to book on this line until you connect a calendar.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={openGoogle} disabled={busy} className="h-7 text-xs">
          <Link2 className="h-3 w-3 mr-1" /> Google
        </Button>
        {provider === "google" && (
          <Button size="sm" variant="outline" onClick={openChangeCalendar} disabled={busy} className="h-7 text-xs">
            <CalendarDays className="h-3 w-3 mr-1" /> Pick sub-calendar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={openAcuity} disabled={busy} className="h-7 text-xs">
          <Link2 className="h-3 w-3 mr-1" /> Acuity
        </Button>
        {admin && (
          <Button
            size="sm"
            variant="outline"
            onClick={connectNewGoogleForLine}
            disabled={busy}
            className="h-7 text-xs"
          >
            <Link2 className="h-3 w-3 mr-1" /> Connect new Google
          </Button>
        )}
        {provider !== "none" && (
          <Button size="sm" variant="ghost" onClick={clear} disabled={busy} className="h-7 text-xs text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Google dialog */}
      <Dialog open={googleOpen} onOpenChange={setGoogleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Calendar for {line.label ?? line.phone_number}</DialogTitle>
            <DialogDescription>
              Pick which team member's Google account hosts this line's calendar, then choose the calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Calendar owner</label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>
                      {(o.display_name ?? "Unnamed")} · {o.google_email ?? "no email"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Calendar</label>
              {loadingCals ? (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading…
                </div>
              ) : calendars.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Only that owner can pick from their own calendars. Sign in as them to choose.
                </div>
              ) : (
                <Select value={calendarId} onValueChange={setCalendarId}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {calendars.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.summary}{c.primary ? " (primary)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGoogleOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveGoogle} disabled={busy || !calendarId}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change calendar dialog (for already-connected Google lines) */}
      <Dialog open={changeCalOpen} onOpenChange={setChangeCalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose calendar for {line.label ?? line.phone_number}</DialogTitle>
            <DialogDescription>
              Pick which calendar in the connected Google account this line should use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {loadingCals ? (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading…
              </div>
            ) : (
              <Select value={calendarId} onValueChange={setCalendarId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.summary}{c.primary ? " (primary)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeCalOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveChangeCalendar} disabled={busy || !calendarId}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acuity dialog */}
      <Dialog open={acuOpen} onOpenChange={setAcuOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acuity appointment type for {line.label ?? line.phone_number}</DialogTitle>
            <DialogDescription>
              {companyAcuity?.acuity_user_id
                ? "Uses the company Acuity account. Enter the Appointment Type ID this line should book into."
                : "You need to connect the company Acuity account first (in the company-wide Booking integration card)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Appointment Type ID</label>
              <Input
                value={acuType}
                onChange={(e) => setAcuType(e.target.value)}
                placeholder="e.g. 789012"
                disabled={!companyAcuity?.acuity_user_id}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcuOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveAcuity} disabled={busy || !companyAcuity?.acuity_user_id}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}