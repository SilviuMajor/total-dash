import { Check, ChevronsUpDown, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useState } from "react";

export function ClientAgentSelector({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { agents, selectedAgentId, setSelectedAgentId, loading } = useClientAgentContext();

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  if (loading) {
    return (
      <div className="animate-pulse w-full">
        <div className="h-9 bg-muted rounded-md"></div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-2 py-1.5 rounded-md bg-muted/50 w-full">
        <p className="text-xs text-muted-foreground">No agents assigned</p>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-9 justify-between rounded-md bg-card hover:bg-muted border-border px-2.5 py-2"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Bot className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate text-foreground">
              {selectedAgent?.name || "Select agent..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-card border-border z-50">
        <Command className="bg-card">
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={agent.name}
                  onSelect={() => {
                    setSelectedAgentId(agent.id);
                    setOpen(false);
                  }}
                  className="hover:bg-muted cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-1.5 h-4 w-4 shrink-0",
                      selectedAgentId === agent.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Bot className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <span className={cn("text-sm", selectedAgentId === agent.id && "font-medium")}>
                    {agent.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}