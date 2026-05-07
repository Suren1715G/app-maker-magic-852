import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const history = [
  { name: "Spring Detail Promo", type: "Promo", channel: "SMS", date: "May 1, 2026", recipients: 412, status: "Sent" },
  { name: "Win-Back May", type: "Win-Back", channel: "SMS", date: "Apr 28, 2026", recipients: 87, status: "Sent" },
  { name: "Post-Service Follow Up", type: "Follow-Up", channel: "Email", date: "Apr 22, 2026", recipients: 156, status: "Scheduled" },
  { name: "Memorial Day Blast", type: "Promo", channel: "SMS", date: "Apr 15, 2026", recipients: 38, status: "Failed" },
];

const statusColor = (s: string) =>
  s === "Sent"
    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
    : s === "Scheduled"
    ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
    : "bg-red-500/15 text-red-500 border-red-500/30";

export default function Campaigns() {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"SMS" | "Email">("SMS");
  const [type, setType] = useState("Promo");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");

  const max = channel === "SMS" ? 160 : 1000;

  return (
    <AppShell>
      <PageHeader title="Campaigns" subtitle="Send SMS and email blasts to your customers" />
      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">New Campaign</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div className="rounded-xl border border-border bg-card/40 backdrop-blur p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Detail Promo" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Channel</label>
                <div className="flex gap-2">
                  {(["SMS", "Email"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 rounded-md border py-2 text-sm transition-colors",
                        channel === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {c === "SMS" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Win-Back">Win-Back</SelectItem>
                    <SelectItem value="Promo">Promo</SelectItem>
                    <SelectItem value="Follow-Up">Follow-Up</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-muted-foreground">Message Body</label>
                  <span className={cn("text-[11px]", body.length > max ? "text-red-500" : "text-muted-foreground")}>
                    {body.length}/{max}
                  </span>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, max))}
                  placeholder="Hey {first_name}, get 20% off detailing this week only…"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Audience</label>
                <div className="space-y-1.5">
                  {[
                    { v: "all", l: "All Customers" },
                    { v: "inactive", l: "Inactive 30+ Days" },
                    { v: "custom", l: "Custom" },
                  ].map((o) => (
                    <label key={o.v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={audience === o.v}
                        onChange={() => setAudience(o.v)}
                        className="accent-primary"
                      />
                      {o.l}
                    </label>
                  ))}
                </div>
              </div>

              <Button
                className="w-full font-semibold"
                onClick={() => {
                  if (!name || !body) return toast.error("Add a name and message");
                  toast.success(`Campaign "${name}" sent!`);
                  setName(""); setBody("");
                }}
              >
                Send Campaign
              </Button>
            </div>

            {/* Phone preview */}
            <div className="flex justify-center lg:justify-start">
              <div className="w-[260px] h-[520px] rounded-[36px] border-[6px] border-foreground/80 bg-background relative shadow-2xl">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-foreground/80 rounded-full" />
                <div className="pt-10 px-3 h-full overflow-y-auto">
                  <p className="text-center text-[10px] text-muted-foreground mb-2">
                    {channel === "SMS" ? "Text Message · Today" : "Email · Today"}
                  </p>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-xs max-w-[85%]">
                    {body || <span className="text-muted-foreground">Your message will appear here…</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Date Sent</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.name}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{h.type}</TableCell>
                    <TableCell>{h.channel}</TableCell>
                    <TableCell>{h.date}</TableCell>
                    <TableCell>{h.recipients}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(h.status)}>{h.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}