import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFreshAccessToken } from "@/lib/authSession";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CalendarDays, Link2, Trash2, FlaskConical, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type CompanyBooking = {
  booking_provider: "google" | "acuity";
  shared_calendar_id: string | null;
  shared_calendar_summary: string | null;
  acuity_user_id: string | null;
  acuity_appointment_type_id: string | null;
  acuity_scheduling_url: string | null;
};

export function CompanyBookingIntegration({ companyId }: { companyId: string }) {
  const [row, setRow] = useState<CompanyBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [acuOpen, setAcuOpen] = useState(false);
  const [acuUser, setAcuUser] = useState("");
  const [acuKey, setAcuKey] = useState("");
  const [acuType, setAcuType] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select(
        "booking_provider, shared_calendar_id, shared_calendar_summary, acuity_user_id, acuity_appointment_type_id, acuity_scheduling_url",
      )
      .eq("id", companyId)
      .maybeSingle();
    setRow((data as CompanyBooking) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [companyId]);

  const connectGoogle = async () => {
    setBusy(true);
    try {
      const token = await getFreshAccessToken();
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
          return_to: `${window.location.origin}${window.location.pathname}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === "Not authenticated" ? "Your login expired. Please sign in again." : json.error ?? "Failed");
      window.location.href = json.url;
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start Google OAuth");
    } finally {
      setBusy(false);
    }
  };

  const callAdminBooking = async (body: Record<string, unknown>) => {
    const token = await getFreshAccessToken();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-set-booking`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, company_id: companyId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed");
    return json;
  };

  const saveAcuity = async () => {
    if (!acuUser.trim() || !acuKey.trim()) {
      toast.error("User ID and API key required");
      return;
    }
    setBusy(true);
    try {
      await callAdminBooking({
        provider: "acuity",
        acuity_user_id: acuUser.trim(),
        acuity_api_key: acuKey.trim(),
        acuity_appointment_type_id: acuType.trim() || null,
      });
      toast.success("Acuity connected");
      setAcuOpen(false);
      setAcuUser("");
      setAcuKey("");
      setAcuType("");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const clearIntegration = async () => {
    if (!confirm("Disconnect this booking integration?")) return;
    setBusy(true);
    try {
      await callAdminBooking({ action: "clear" });
      toast.success("Disconnected");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const testBooking = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = await getFreshAccessToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-booking`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_id: companyId, action: "get_provider" }),
      });
      const result = await res.json();
      const inner = result?.data ?? {};
      if (!res.ok) throw new Error(inner?.error ?? `HTTP ${res.status}`);
      const ok = Boolean(inner?.configured);
      setTestResult({
        ok,
        text: ok
          ? `Provider "${inner.provider}" is connected and reachable.`
          : `Provider "${inner.provider}" is selected but NOT configured. Connect it above.`,
      });
    } catch (e: any) {
      setTestResult({ ok: false, text: e.message ?? "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const provider = row?.booking_provider ?? "google";
  const isConnected =
    (provider === "google" && !!row?.shared_calendar_id) ||
    (provider === "acuity" && !!row?.acuity_user_id);

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Booking integration
        </h2>
        {!loading && (
          <span
            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
              isConnected ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            {isConnected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isConnected ? "Ready" : "Not set up"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {isConnected ? (
            <div className="rounded-lg border border-border/60 p-3 mb-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                  {provider}
                </span>
                <span className="text-xs text-muted-foreground">connected</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground break-all">
                {provider === "google" && (row.shared_calendar_summary ?? row.shared_calendar_id)}
                {provider === "acuity" && (row.acuity_scheduling_url ?? `User ${row.acuity_user_id}`)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-destructive hover:text-destructive"
                onClick={clearIntegration}
                disabled={busy}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Disconnect
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">
              No booking integration. Connect one below so the AI agent can book appointments.
            </p>
          )}

          <div className="grid grid-cols-1 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={connectGoogle}
              disabled={busy}
              className="justify-start"
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Connect Google Calendar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAcuOpen(true)}
              disabled={busy}
              className="justify-start"
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Connect Squarespace (Acuity)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={testBooking}
              disabled={testing || busy}
              className="justify-start"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 mr-1.5" />}
              Test booking integration
            </Button>
            {testResult && (
              <div
                className={`text-xs rounded-md p-2 ${
                  testResult.ok
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {testResult.text}
              </div>
            )}
          </div>
        </>
      )}

      {/* Acuity dialog */}
      <Dialog open={acuOpen} onOpenChange={setAcuOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Squarespace Scheduling (Acuity)</DialogTitle>
            <DialogDescription>
              In the client's Acuity account: Integrations → API → copy the User ID and API Key.
              Optionally provide an Appointment Type ID to constrain bookings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">User ID</label>
              <Input value={acuUser} onChange={(e) => setAcuUser(e.target.value)} placeholder="123456" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">API Key</label>
              <Input value={acuKey} onChange={(e) => setAcuKey(e.target.value)} placeholder="abcd1234..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Appointment Type ID (optional)</label>
              <Input value={acuType} onChange={(e) => setAcuType(e.target.value)} placeholder="789012" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcuOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveAcuity} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
