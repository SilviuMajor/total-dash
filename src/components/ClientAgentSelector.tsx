import { Check, ChevronsUpDown } from "lucide-react";
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AgentType {
  provider: string;
  function_name: string;
}

export function ClientAgentSelector() {
  const [open, setOpen] = useState(false);
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([]);
  const { agents, selectedAgentId, setSelectedAgentId, loading } = useClientAgentContext();

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  useEffect(() => {
    loadAgentTypes();
  }, []);

  const loadAgentTypes = async () => {
    const { data } = await supabase
      .from('agent_types')
      .select('provider, function_name');
    
    if (data) {
      setAgentTypes(data);
    }
  };

  const getAgentFunction = (provider: string) => {
    const agentType = agentTypes.find(t => t.provider === provider);
    return agentType?.function_name || 'Agent';
  };

  if (loading) {
    return (
      <div className="px-4 py-2 rounded-lg bg-muted/50 animate-pulse w-48">
        <div className="h-8 bg-muted rounded"></div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-4 py-3 rounded-md bg-muted/50 w-52">
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
          className="w-52 h-14 justify-between rounded-md bg-card hover:bg-muted border-border"
        >
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-sm font-semibold truncate w-full text-left text-foreground">
              {selectedAgent?.name || "Select agent..."}
            </span>
            {selectedAgent && (
              <span className="text-xs text-muted-foreground truncate w-full text-left">
                {getAgentFunction(selectedAgent.provider)}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0 bg-card border-border z-50">
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
                      "mr-2 h-4 w-4",
                      selectedAgentId === agent.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{getAgentFunction(agent.provider)}</span>
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