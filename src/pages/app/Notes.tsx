import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { StickyNote, Trash2, Check, Clock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  body: string | null;
  due_at: string | null;
  done: boolean;
  created_at: string;
}

const Notes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setCompanyId(profile.company_id);
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, body, due_at, done, created_at")
      .eq("company_id", profile.company_id)
      .order("done", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setNotes(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAdd = async () => {
    if (!title.trim() || !user || !companyId) return;
    const { error } = await supabase.from("notes").insert({
      company_id: companyId,
      created_by: user.id,
      title: title.trim(),
      body: body.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Note saved.");
    setTitle("");
    setBody("");
    setDueAt("");
    setAdding(false);
    load();
  };

  const toggleDone = async (n: Note) => {
    const { error } = await supabase
      .from("notes")
      .update({ done: !n.done })
      .eq("id", n.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted.");
      load();
    }
  };

  const open = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);

  return (
    <AppShell>
      <PageHeader
        title="Notes"
        subtitle="Quick notes & reminders. Jarvis can add these for you too."
        right={
          <Button
            size="sm"
            variant={adding ? "outline" : "default"}
            onClick={() => setAdding((v) => !v)}
            className="gap-1"
          >
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {adding ? "Cancel" : "New"}
          </Button>
        }
      />

      {adding && (
        <div className="glass rounded-2xl p-4 mb-6 space-y-3 animate-slide-up">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="Details (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Reminder time (optional)
            </label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={!title.trim()} className="w-full">
            Save
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <StickyNote className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No notes yet. Add one above or just ask Jarvis: <em>"Remind me to call John tomorrow at 9."</em>
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="space-y-2 mb-6">
              {open.map((n) => (
                <NoteItem key={n.id} note={n} onToggle={toggleDone} onDelete={remove} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Completed
              </div>
              <ul className="space-y-2">
                {done.map((n) => (
                  <NoteItem key={n.id} note={n} onToggle={toggleDone} onDelete={remove} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </AppShell>
  );
};

function NoteItem({
  note: n,
  onToggle,
  onDelete,
}: {
  note: Note;
  onToggle: (n: Note) => void;
  onDelete: (id: string) => void;
}) {
  const dueLabel = n.due_at
    ? new Date(n.due_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const overdue =
    n.due_at && !n.done && new Date(n.due_at).getTime() < Date.now();

  return (
    <li
      className={cn(
        "glass rounded-2xl p-4 flex gap-3",
        n.done && "opacity-50",
        overdue && "ring-1 ring-destructive/40",
      )}
    >
      <button
        type="button"
        aria-label={n.done ? "Mark incomplete" : "Mark complete"}
        onClick={() => onToggle(n)}
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border transition-colors",
          n.done
            ? "bg-success/20 border-success/40 text-success"
            : "border-border hover:border-primary",
        )}
      >
        {n.done && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium text-sm", n.done && "line-through")}>
          {n.title}
        </div>
        {n.body && (
          <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
            {n.body}
          </div>
        )}
        {dueLabel && (
          <div
            className={cn(
              "text-[11px] mt-1 flex items-center gap-1",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <Clock className="h-3 w-3" /> {dueLabel}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Delete"
        onClick={() => onDelete(n.id)}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export default Notes;
