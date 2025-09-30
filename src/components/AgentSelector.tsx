import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { useAuth } from "@/hooks/useAuth";

interface Agent {
  id: string;
  name: string;
  provider: string;
}

export function AgentSelector() {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedAgentId, setSelectedAgentId } = useAgentSelection();
  const { profile } = useAuth();

  useEffect(() => {
    loadAgents();
  }, [profile]);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, provider')
        .order('name');

      if (error) throw error;
      
      setAgents(data || []);
      
      // Auto-select first agent if none selected
      if (!selectedAgentId && data && data.length > 0) {
        setSelectedAgentId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  if (loading) {
    return (
      <div className="px-4 py-3 rounded-lg bg-muted/50 animate-pulse">
        <div className="h-4 bg-muted rounded w-24"></div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-4 py-3 rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground">No agents assigned</p>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-muted/50 hover:bg-muted"
        >
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">Selected Agent</span>
            <span className="text-sm font-medium truncate w-full text-left">
              {selectedAgent?.name || "Select agent..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 bg-card border-border z-50">
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
