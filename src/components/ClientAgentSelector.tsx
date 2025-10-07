import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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

export function ClientAgentSelector() {
  const [open, setOpen] = useState(false);
  const { agents, selectedAgentId, setSelectedAgentId, loading } = useClientAgentContext();

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  if (loading) {
    return (
      <div className="px-4 py-2 rounded-lg bg-muted/50 animate-pulse w-48">
        <div className="h-8 bg-muted rounded"></div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-4 py-2 rounded-lg bg-muted/50 w-48">
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
          className="w-48 justify-between h-auto py-2 bg-card hover:bg-muted border-border"
        >
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">Active Agent</span>
            <span className="text-sm font-semibold truncate w-full text-left text-foreground">
              {selectedAgent?.name || "Select agent..."}
            </span>
            {selectedAgent && (
              <span className="text-xs text-muted-foreground truncate w-full text-left">
                {selectedAgent.provider}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0 bg-card border-border z-50">
        <Command className="bg-card">
          <CommandInput placeholder="Search agents..." className="bg-muted/30" />
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
                      "mr-2 h-4 w-4",
                      selectedAgentId === agent.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{agent.provider}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}