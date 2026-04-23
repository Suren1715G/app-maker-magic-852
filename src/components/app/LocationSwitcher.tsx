import { Building2, Check, ChevronDown, Layers } from "lucide-react";
import { useLocationCtx } from "@/contexts/LocationContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function LocationSwitcher() {
  const { active, setActive, list } = useLocationCtx();
  const label = active === "all" ? "All locations" : active.name;
  const Icon = active === "all" ? Layers : Building2;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="glass rounded-full pl-2.5 pr-2 py-1 flex items-center gap-1.5 text-xs font-medium hover:bg-secondary/40 transition-colors">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="truncate max-w-[120px]">{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
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
          <DropdownMenuItem key={l.id} onClick={() => setActive(l)}>
            <Building2 className={cn("h-4 w-4", l.isPrimary && "text-primary")} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{l.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{l.address}</div>
            </div>
            {active !== "all" && active.id === l.id && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}