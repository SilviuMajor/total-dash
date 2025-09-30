import { create } from 'zustand';

interface AgentSelectionStore {
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export const useAgentSelection = create<AgentSelectionStore>((set) => ({
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
}));
