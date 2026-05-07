import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Megaphone, Send, MessageSquare, Mail, Smartphone, Users, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = "sms" | "email";
type CampaignType = "Win-Back" | "Promo" | "Follow-Up" | "Custom";
type Audience = "All Customers" | "Inactive 30+ Days" | "Custom";
type Schedule = "now" | "later";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  type: string;
  audience: string;
  message_body: string;
  status: string;
  recipients_count: number;
  sent_at: string | null;
  created_at: string;
}

const TYPES: CampaignType[] = ["Win-Back", "Promo", "Follow-Up", "Custom"];
const AUDIENCES: Audience[] = ["All Customers", "Inactive 30+ Days", "Custom"];
const AUDIENCE_REACH: Record<Audience, number> = {
  "All Customers": 142,
  "Inactive 30+ Days": 38,
  "Custom": 12,
};
const PERSONALIZATION_TAGS = ["{name}", "{last_service}", "{business_name}", "{promo_code}"];

const SAMPLE_HISTORY = [
  { id: "s1", name: "Spring Cleaning Promo", type: "Promo", channel: "sms", sent_at: "2026-04-22T15:00:00Z", recipients_count: 142, open_rate: 64, status: "sent" },
  { id: "s2", name: "We Miss You — 20% Off", type: "Win-Back", channel: "email", sent_at: "2026-04-15T10:30:00Z", recipients_count: 38, open_rate: 41, status: "sent" },
  { id: "s3", name: "Mother's Day Reminder", type: "Promo", channel: "sms", sent_at: "2026-05-08T09:00:00Z", recipients_count: 142, open_rate: 0, status: "scheduled" },
  { id: "s4", name: "Follow-Up: April Visits", type: "Follow-Up", channel: "email", sent_at: "2026-04-03T14:15:00Z", recipients_count: 27, open_rate: 0, status: "failed" },
] as any[];

const Campaigns = () => {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [history, setHistory] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [type, setType] = useState<CampaignType>("Promo");
  const [audience, setAudience] = useState<Audience>("All Customers");
  const [message, setMessage] = useState("");
  const [schedule, setSchedule] = useState<Schedule>("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.company_id) { setLoading(false); return; }
      setCompanyId(profile.company_id);
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setHistory(data ?? []);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const reload = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("campaigns").select("*").eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setHistory(data ?? []);
  };

  const handleSend = async () => {
    if (!name.trim() || !message.trim() || !companyId || !user) {
      toast.error("Please fill in name and message.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("campaigns").insert({
      company_id: companyId,
      created_by: user.id,
      name: name.trim(),
      channel,
      type,
      audience,
      message_body: message,
      status: "sent",
      recipients_count: 0,
      sent_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campaign sent.");
    setName(""); setMessage(""); setType("Promo"); setAudience("All Customers"); setChannel("sms");
    reload();
  };

  const counter = useMemo(() => message.length, [message]);
  const overLimit = counter > 160;
  const reach = AUDIENCE_REACH[audience];

  const insertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) { setMessage((m) => m + tag); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + tag + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const openConfirm = () => {
    if (!name.trim() || !message.trim()) {
      toast.error("Please fill in name and message.");
      return;
    }
    if (schedule === "later" && !scheduledAt) {
      toast.error("Pick a date and time to schedule.");
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    setConfirmOpen(false);
    await handleSend();
  };

  const mergedHistory = useMemo(() => {
    return [...history, ...SAMPLE_HISTORY];
  }, [history]);

  const stats = useMemo(() => {
    const sent = mergedHistory.filter((c: any) => c.status === "sent");
    const total = sent.length;
    const reached = sent.reduce((a: number, c: any) => a + (c.recipients_count || 0), 0);
    const rates = sent.map((c: any) => c.open_rate ?? 0).filter((r: number) => r > 0);
    const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    return { total, reached, avg };
  }, [mergedHistory]);

  const statusVariant = (s: string) => {
    return "outline";
  };

  const statusClass = (s: string) => {
    if (s === "sent") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    if (s === "scheduled") return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    if (s === "failed") return "bg-red-500/15 text-red-600 border-red-500/30";
    return "";
  };

  return (
    <AppShell>
      <PageHeader title="Campaigns" subtitle="Reach customers with SMS or email blasts" />

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="new">New Campaign</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
              <div className="space-y-2">
                <Label>Campaign name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring promo blast" />
              </div>

              <div className="space-y-2">
                <Label>Channel</Label>
                <div className="inline-flex rounded-lg border border-border/60 p-1 bg-secondary/30">
                  <button
                    type="button"
                    onClick={() => setChannel("sms")}
                    className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                      channel === "sms" ? "bg-background shadow-sm" : "text-muted-foreground")}
                  >
                    <MessageSquare className="h-4 w-4" /> SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("email")}
                    className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                      channel === "email" ? "bg-background shadow-sm" : "text-muted-foreground")}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Campaign type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as CampaignType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> ~{reach} customers will receive this
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message</Label>
                  <span className={cn("text-xs", overLimit ? "text-destructive" : "text-muted-foreground")}>
                    {counter} / 160
                  </span>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi {name}! We miss you — come back for 20% off this week."
                  rows={5}
                />
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Personalization tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PERSONALIZATION_TAGS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => insertTag(t)}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/70 border border-border/60 font-mono transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Schedule</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="schedule"
                      checked={schedule === "now"}
                      onChange={() => setSchedule("now")}
                      className="accent-primary"
                    />
                    Send Now
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="schedule"
                      checked={schedule === "later"}
                      onChange={() => setSchedule("later")}
                      className="accent-primary"
                    />
                    Schedule for Later
                  </label>
                </div>
                {schedule === "later" && (
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="max-w-xs"
                  />
                )}
              </div>

              <Button onClick={openConfirm} disabled={saving} className="w-full sm:w-auto">
                <Send className="h-4 w-4 mr-2" />
                {saving ? "Sending..." : schedule === "later" ? "Schedule campaign" : "Send campaign"}
              </Button>
            </div>

            {/* Live phone preview */}
            <div className="lg:sticky lg:top-4 self-start">
              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Live preview
              </div>
              <div className="mx-auto w-full max-w-[280px] aspect-[9/19] rounded-[2.25rem] border-[10px] border-foreground/80 bg-background shadow-xl overflow-hidden flex flex-col">
                <div className="h-7 bg-foreground/80 flex items-center justify-center">
                  <div className="h-1.5 w-16 rounded-full bg-background/30" />
                </div>
                <div className="flex-1 p-3 bg-secondary/40 flex flex-col gap-2 overflow-y-auto">
                  <div className="text-[10px] text-muted-foreground text-center">
                    {channel === "sms" ? "Today" : "Inbox preview"}
                  </div>
                  {channel === "email" && (
                    <div className="text-[11px] font-semibold text-foreground px-1">
                      {name || "(Your campaign name)"}
                    </div>
                  )}
                  <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-background border border-border/60 px-3 py-2 text-[12px] leading-snug whitespace-pre-wrap break-words">
                    {message || <span className="text-muted-foreground">Your message will appear here…</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Total Sent</span>
                <Send className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">{stats.total}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Customers Reached</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">{stats.reached.toLocaleString()}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Avg Open Rate</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-1 font-display text-2xl font-semibold">{stats.avg}%</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Date sent</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergedHistory.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.type}</TableCell>
                      <TableCell className="uppercase text-xs">{c.channel}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">{c.recipients_count}</TableCell>
                      <TableCell className="text-right">
                        {c.status === "sent" ? `${c.open_rate ?? 0}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", statusClass(c.status))}>
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm campaign</DialogTitle>
            <DialogDescription>
              Review the details before {schedule === "later" ? "scheduling" : "sending"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium text-right">{name || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Audience</span>
              <span className="font-medium text-right">{audience} • ~{reach} customers</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Channel</span>
              <span className="font-medium uppercase text-right">{channel}</span>
            </div>
            {schedule === "later" && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Scheduled</span>
                <span className="font-medium text-right">
                  {scheduledAt ? new Date(scheduledAt).toLocaleString() : "—"}
                </span>
              </div>
            )}
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm whitespace-pre-wrap break-words">
              {message}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSend}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm & {schedule === "later" ? "Schedule" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Campaigns;
