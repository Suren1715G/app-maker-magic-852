import { useState } from "react";
import { Building2, Check, ChevronDown, Layers, Plus, Trash2 } from "lucide-react";
import { useLocationCtx } from "@/contexts/LocationContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LocationSwitcher() {
  const { active, setActive, list, addLocation, removeLocation, isDemo } = useLocationCtx();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const empty = list.length === 0;
  const single = list.length === 1;

  // Empty state — show CTA only (no demo, no locations yet)
  if (empty && !isDemo) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="glass rounded-full pl-2.5 pr-3 py-1 flex items-center gap-1.5 text-xs font-medium hover:bg-secondary/40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          <span>Add location</span>
        </button>
        <AddDialog
          open={open}
          onOpenChange={setOpen}
          name={name}
          address={address}
          setName={setName}
          setAddress={setAddress}
          onSave={() => {
            if (!name.trim() || !address.trim()) {
              toast.error("Name and address required");
              return;
            }
            addLocation({ name, address });
            toast.success("Location added");
            setName(""); setAddress(""); setOpen(false);
          }}
        />
      </>
    );
  }

  // Single location — show name only, with menu to add more or delete
  if (single && !isDemo) {
    const only = list[0];
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="glass rounded-full pl-2.5 pr-2 py-1 flex items-center gap-1.5 text-xs font-medium hover:bg-secondary/40 transition-colors">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span className="truncate max-w-[140px]">{only.name}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Your location
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{only.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{only.address}</div>
              </div>
              <button
                onClick={() => { removeLocation(only.id); toast.success("Location removed"); }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete location"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-sm">Add another location</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AddDialog
          open={open}
          onOpenChange={setOpen}
          name={name}
          address={address}
          setName={setName}
          setAddress={setAddress}
          onSave={() => {
            if (!name.trim() || !address.trim()) {
              toast.error("Name and address required");
              return;
            }
            addLocation({ name, address });
            toast.success("Location added");
            setName(""); setAddress(""); setOpen(false);
          }}
        />
      </>
    );
  }

  // Multi-location (or demo) — full switcher with All locations
  const label = active === "all" ? "All locations" : active.name;
  const Icon = active === "all" ? Layers : Building2;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="glass rounded-full pl-2.5 pr-2 py-1 flex items-center gap-1.5 text-xs font-medium hover:bg-secondary/40 transition-colors">
            <Icon className="h-3.5 w-3.5 text-primary" />
            <span className="truncate max-w-[120px]">{label}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Switch location
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setActive("all")}>
            <Layers className="h-4 w-4" />
            <div className="flex-1">
              <div className="text-sm">All locations</div>
              <div className="text-[10px] text-muted-foreground">Combined overview</div>
            </div>
            {active === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {list.map((l) => (
            <DropdownMenuItem
              key={l.id}
              onSelect={(e) => { e.preventDefault(); setActive(l); }}
              className="gap-2"
            >
              <Building2 className={cn("h-4 w-4", l.isPrimary && "text-primary")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{l.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{l.address}</div>
              </div>
              {active !== "all" && active.id === l.id && <Check className="h-3.5 w-3.5 text-primary" />}
              {!isDemo && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeLocation(l.id); toast.success("Location removed"); }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete location"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </DropdownMenuItem>
          ))}
          {!isDemo && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-sm">Add location</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!isDemo && (
        <AddDialog
          open={open}
          onOpenChange={setOpen}
          name={name}
          address={address}
          setName={setName}
          setAddress={setAddress}
          onSave={() => {
            if (!name.trim() || !address.trim()) {
              toast.error("Name and address required");
              return;
            }
            addLocation({ name, address });
            toast.success("Location added");
            setName(""); setAddress(""); setOpen(false);
          }}
        />
      )}
    </>
  );
}

function AddDialog({
  open, onOpenChange, name, address, setName, setAddress, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  address: string;
  setName: (v: string) => void;
  setAddress: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a location</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Downtown office"
              autoFocus
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Address</div>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave}>Add location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
