import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MasterShell } from "@/components/master/MasterShell";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { calls, bookings, sms } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Detail = {
  id: string;
  name: string;
  created_at: string;
  profiles: {
    user_id: string;
    display_name: string | null;
    business_name: string | null;
    created_at: string;
  }[];
  access_codes: {
    id: string;
    code: string;
    used_at: string | null;
    used_by: string | null;
    notes: string | null;
    created_at: string;
  }[];
};

type PhoneRow = {
  id: string;
  label: string | null;
  phone_number: string;
  status: "pending" | "active" | "disabled";
  created_at: string;
};

const MasterCompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [phones, setPhones] = useState<PhoneRow[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: row, error } = await supabase
        .from("companies")
        .select(
          "id, name, created_at, profiles(user_id, display_name, business_name, created_at), access_codes(id, code, used_at, used_by, notes, created_at)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !row) {
        setNotFound(true);
        return;
      }
      setData(row as Detail);
      await loadPhones(row.id);
    })();
  }, [id]);

  const loadPhones = async (cid: string) => {
    const { data } = await supabase
      .from("company_phone_numbers")
      .select("id, label, phone_number, status, created_at")
      .eq("company_id", cid)
      .order("created_at", { ascending: true });
    setPhones((data ?? []) as PhoneRow[]);
  };

  const setStatus = async (pid: string, status: PhoneRow["status"]) => {
    const { error } = await supabase
      .from("company_phone_numbers")
      .update({ status })
      .eq("id", pid);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    if (id) await loadPhones(id);
  };

  const adminAddPhone = async () => {
    if (!id) return;
    if (!newPhone.trim()) return toast.error("Phone required");
    const { error } = await supabase.from("company_phone_numbers").insert({
      company_id: id,
      label: newLabel.trim() || null,
      phone_number: newPhone.trim(),
      provider: "twilio",
      status: "active",
    });
    if (error) return toast.error(error.message);
    toast.success("Phone added");
    setNewLabel("");
    setNewPhone("");
    await loadPhones(id);
  };

  const adminDeletePhone = async (pid: string) => {
    const { error } = await supabase.from("company_phone_numbers").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    if (id) await loadPhones(id);
  };

  // Note: live customer data lives in the company's own tables which we haven't
  // built yet (calls/bookings/sms are still mock for the customer dashboard).
  // We show the same mock data here as a placeholder so the drill-down has
  // something visual until real per-company data is wired up.
  const recentCalls = calls.slice(0, 3);
  const upcoming = bookings.slice(0, 3);
  const recentSms = sms.slice(0, 3);

  return (
    <MasterShell
      title={data?.name ?? (notFound ? "Not found" : "Loading…")}
      subtitle={data ? `Joined ${new Date(data.created_at).toLocaleDateString()}` : undefined}
      right={
        <Link
          to="/master/companies"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      }
    >
      {notFound && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          That company doesn't exist (or was removed).
        </div>
      )}

      {!data && !notFound && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: company info */}
          <div className="lg:col-span-1 space-y-5">
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Users ({data.profiles.length})
              </h2>
              {data.profiles.length === 0 && (
                <p className="text-sm text-muted-foreground">No users yet.</p>
              )}
              <ul className="space-y-2">
                {data.profiles.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                      {(p.display_name?.[0] ?? "?").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {p.display_name ?? "Unnamed user"}
                      </div>
                      {p.business_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {p.business_name}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Access codes
              </h2>
              <ul className="space-y-2">
                {data.access_codes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-mono text-xs tracking-wider truncate">
                      {c.code}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                        c.used_at
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {c.used_at ? "Used" : "Open"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone numbers ({phones.length})
              </h2>
              {phones.length === 0 && (
                <p className="text-sm text-muted-foreground mb-3">No numbers yet.</p>
              )}
              <ul className="space-y-2 mb-3">
                {phones.map((p) => {
                  const tone =
                    p.status === "active"
                      ? "bg-success/15 text-success"
                      : p.status === "pending"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground";
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{p.label ?? "Untitled"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{p.phone_number}</div>
                      </div>
                      <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full shrink-0 ${tone}`}>
                        {p.status}
                      </span>
                      {p.status !== "active" && (
                        <button
                          onClick={() => setStatus(p.id, "active")}
                          className="text-[10px] text-success hover:underline"
                        >
                          Activate
                        </button>
                      )}
                      {p.status === "active" && (
                        <button
                          onClick={() => setStatus(p.id, "disabled")}
                          className="text-[10px] text-muted-foreground hover:underline"
                        >
                          Disable
                        </button>
                      )}
                      <button
                        onClick={() => adminDeletePhone(p.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Location label"
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="h-9 flex-1"
                  />
                  <Button size="sm" onClick={adminAddPhone}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {/* Right: activity preview */}
          <div className="lg:col-span-2 space-y-5">
            <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
              Activity below is sample data — real customer call/SMS/booking history will appear here once the customer-facing data is wired up to the backend.
            </div>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Recent calls
              </h2>
              <ul className="divide-y divide-border/40">
                {recentCalls.map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.caller}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.summary}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Upcoming bookings
              </h2>
              <ul className="divide-y divide-border/40">
                {upcoming.map((b) => (
                  <li key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{b.customer}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {b.service} · {new Date(b.startsAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Recent SMS
              </h2>
              <ul className="divide-y divide-border/40">
                {recentSms.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <div className="text-sm font-medium">{s.customer}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {s.body}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </MasterShell>
  );
};

export default MasterCompanyDetail;